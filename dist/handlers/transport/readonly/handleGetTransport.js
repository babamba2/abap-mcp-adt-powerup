"use strict";
/**
 * GetTransport Handler - Retrieve ABAP transport request information via ADT API
 *
 * ADT exposes TWO transport endpoints with different semantics per backend:
 *
 *   1. Path-based single-TR read:   GET /sap/bc/adt/cts/transportrequests/<NUMBER>
 *        Accept: application/vnd.sap.adt.transportorganizer.v1+xml
 *      S/4HANA: returns the TR natively ({tm:root adtcore:name=<NUMBER> > tm:request}).
 *      ECC:     path segment is effectively ignored — response is a user-scoped LIST
 *               ({tm:root adtcore:name=<USER> > tm:workbench > tm:modifiable > tm:request[]}).
 *
 *   2. List-by-user:                GET /sap/bc/adt/cts/transportrequests?user=<OWNER>
 *        Accept: application/vnd.sap.adt.transportorganizertree.v1+xml
 *      Both: list scoped to the owning user.
 *
 * Strategy: path URL first (native on S/4, acceptable fallback on ECC). If the TR is
 * not found in the path response AND `owner` was supplied, retry with the list URL
 * (handles cross-user queries, especially on ECC where the path URL only reveals the
 * session user's list).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetTransport = handleGetTransport;
const fast_xml_parser_1 = require("fast-xml-parser");
const systemContext_1 = require("../../../lib/systemContext");
const utils_1 = require("../../../lib/utils");
const ACCEPT_ORGANIZER_V1 = 'application/vnd.sap.adt.transportorganizer.v1+xml, application/vnd.sap.adt.transportorganizertree.v1+xml';
exports.TOOL_DEFINITION = {
    name: 'GetTransport',
    available_in: ['onprem', 'cloud'],
    description: '[read-only] Retrieve ABAP transport request information including metadata, included objects, and status from SAP system.',
    inputSchema: {
        type: 'object',
        properties: {
            transport_number: {
                type: 'string',
                description: 'Transport request number (e.g., E19K905635, DEVK905123)',
            },
            owner: {
                type: 'string',
                description: "SAP user who owns the transport. On ECC the session-user-scoped path endpoint silently filters out other users' TRs — pass `owner` to retry via the list endpoint. On S/4 usually unnecessary, but provide it if the path read is rejected by authorization.",
            },
            include_objects: {
                type: 'boolean',
                description: 'Include list of objects in transport (default: true)',
                default: true,
            },
            include_tasks: {
                type: 'boolean',
                description: 'Include list of tasks in transport (default: true)',
                default: true,
            },
        },
        required: ['transport_number'],
    },
};
function makeParser() {
    return new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
        textNodeName: '_text',
        parseAttributeValue: true,
        isArray: (name, _jpath, _isLeafNode, _isAttribute) => {
            return [
                'tm:request',
                'tm:task',
                'tm:abap_object',
                'tm:object',
                'object',
                'task',
            ].includes(name);
        },
    });
}
/**
 * Find a specific tm:request inside a list-view response
 * (tm:root > tm:workbench|tm:customizing > tm:modifiable|tm:released > tm:request[]).
 */
function findRequestInListView(root, number) {
    if (!root)
        return null;
    for (const catKey of ['tm:workbench', 'tm:customizing']) {
        const category = root[catKey];
        if (!category)
            continue;
        for (const statusKey of ['tm:modifiable', 'tm:released']) {
            const group = category[statusKey];
            if (!group)
                continue;
            const reqs = group['tm:request'];
            if (!reqs)
                continue;
            const arr = Array.isArray(reqs) ? reqs : [reqs];
            for (const req of arr) {
                if (req && req['tm:number'] === number)
                    return req;
            }
        }
    }
    // Back-compat: some SAP versions flatten requests directly under root
    const direct = root['tm:request'];
    if (direct) {
        const arr = Array.isArray(direct) ? direct : [direct];
        for (const req of arr) {
            if (req && req['tm:number'] === number)
                return req;
        }
    }
    return null;
}
/**
 * Pick the tm:request node from either a single-TR or list-view response.
 * Returns { request, viewType } or null when the requested TR isn't present.
 */
function extractRequest(xmlData, requestedNumber) {
    const parser = makeParser();
    const result = parser.parse(xmlData);
    const root = result['tm:root'] || result.root;
    if (!root) {
        throw new utils_1.McpError(utils_1.ErrorCode.InternalError, 'Invalid transport XML structure - no tm:root found');
    }
    // S/4 native path response: adtcore:name is the TR number and tm:request is a direct child.
    if (root['adtcore:name'] === requestedNumber && root['tm:request']) {
        const r = Array.isArray(root['tm:request'])
            ? root['tm:request'][0]
            : root['tm:request'];
        if (r && r['tm:number'] === requestedNumber) {
            return { request: r, viewType: 'single-tr' };
        }
    }
    // Otherwise treat as list view (ECC path response, or list URL response).
    const hit = findRequestInListView(root, requestedNumber);
    if (hit)
        return { request: hit, viewType: 'list' };
    return null;
}
function buildTransportData(request, includeObjects, includeTasks) {
    const transportInfo = {
        number: request['tm:number'],
        description: request['tm:desc'] || request['tm:description'],
        type: request['tm:type'],
        status: request['tm:status'],
        status_text: request['tm:status_text'],
        owner: request['tm:owner'],
        target_system: request['tm:target'],
        target_desc: request['tm:target_desc'],
        created_at: request['tm:createdAt'] || request['tm:lastchanged_timestamp'],
        created_by: request['tm:createdBy'] || request['tm:owner'],
        changed_at: request['tm:changedAt'] || request['tm:lastchanged_timestamp'],
        changed_by: request['tm:changedBy'],
        release_date: request['tm:releaseDate'],
        client: request['tm:source_client'],
        cts_project: request['tm:cts_project'],
        cts_project_desc: request['tm:cts_project_desc'],
    };
    let objects = [];
    if (includeObjects) {
        if (request['tm:all_objects']) {
            const objectList = request['tm:all_objects']['tm:abap_object'] || [];
            objects = Array.isArray(objectList) ? [...objectList] : [objectList];
        }
        if (objects.length === 0 && request['tm:task']) {
            const taskList = Array.isArray(request['tm:task'])
                ? request['tm:task']
                : [request['tm:task']];
            for (const task of taskList) {
                const taskObjs = task && task['tm:abap_object'];
                if (!taskObjs)
                    continue;
                const arr = Array.isArray(taskObjs) ? taskObjs : [taskObjs];
                objects.push(...arr);
            }
        }
        objects = objects.map((obj) => ({
            name: obj['tm:name'],
            type: obj['tm:type'],
            wbtype: obj['tm:wbtype'],
            pgmid: obj['tm:pgmid'],
            description: obj['tm:obj_desc'],
            position: obj['tm:position'],
            lock_status: obj['tm:lock_status'],
            info: obj['tm:obj_info'],
        }));
    }
    let tasks = [];
    if (includeTasks && request['tm:task']) {
        const taskList = Array.isArray(request['tm:task'])
            ? request['tm:task']
            : [request['tm:task']];
        tasks = taskList.map((task) => ({
            number: task['tm:number'],
            parent: task['tm:parent'],
            description: task['tm:desc'],
            type: task['tm:type'],
            status: task['tm:status'],
            status_text: task['tm:status_text'],
            owner: task['tm:owner'],
            target: task['tm:target'],
            target_desc: task['tm:target_desc'],
            client: task['tm:source_client'],
            created_at: task['tm:lastchanged_timestamp'],
            objects: task['tm:abap_object']
                ? (Array.isArray(task['tm:abap_object'])
                    ? task['tm:abap_object']
                    : [task['tm:abap_object']]).map((obj) => ({
                    name: obj['tm:name'],
                    type: obj['tm:type'],
                    wbtype: obj['tm:wbtype'],
                    description: obj['tm:obj_desc'],
                    position: obj['tm:position'],
                }))
                : [],
        }));
    }
    return {
        transport: transportInfo,
        objects: includeObjects ? objects : undefined,
        tasks: includeTasks ? tasks : undefined,
        object_count: objects.length,
        task_count: tasks.length,
    };
}
/**
 * Main handler for GetTransport MCP tool.
 * Strategy: path-based read first, list-by-user fallback when owner is supplied.
 */
async function handleGetTransport(context, args) {
    const { connection, logger } = context;
    try {
        if (!args?.transport_number) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, 'Transport number is required');
        }
        const typedArgs = args;
        const includeObjects = typedArgs.include_objects !== false;
        const includeTasks = typedArgs.include_tasks !== false;
        const trNumber = typedArgs.transport_number;
        const sessionUser = (0, systemContext_1.getSystemContext)().responsible || process.env.SAP_USERNAME || '';
        const owner = typedArgs.owner || '';
        const headers = { Accept: ACCEPT_ORGANIZER_V1 };
        // Attempt 1: path-based single-TR read.
        const pathUrl = `/sap/bc/adt/cts/transportrequests/${encodeURIComponent(trNumber)}`;
        logger?.debug(`GetTransport: path URL attempt — ${pathUrl}`);
        const pathResp = await (0, utils_1.makeAdtRequestWithTimeout)(connection, pathUrl, 'GET', 'default', undefined, undefined, headers);
        let found = extractRequest(pathResp.data, trNumber);
        let resolvedVia = 'path';
        let usedOwner = sessionUser;
        let lastResponse = pathResp;
        // Attempt 2: list-by-owner fallback. Triggered when path read didn't locate the TR
        // and the caller supplied an explicit owner (most common on ECC for cross-user queries).
        if (!found && owner && owner !== sessionUser) {
            const query = new URLSearchParams({ user: owner });
            const listUrl = `/sap/bc/adt/cts/transportrequests?${query.toString()}`;
            logger?.debug(`GetTransport: list-by-owner fallback — ${listUrl}`);
            const listResp = await (0, utils_1.makeAdtRequestWithTimeout)(connection, listUrl, 'GET', 'default', undefined, undefined, headers);
            found = extractRequest(listResp.data, trNumber);
            if (found) {
                resolvedVia = 'list';
                usedOwner = owner;
                lastResponse = listResp;
            }
        }
        if (!found) {
            throw new utils_1.McpError(utils_1.ErrorCode.InvalidParams, `Transport ${trNumber} not found via path read${owner ? ` or owner=${owner} list` : ''}. If this TR belongs to a different user, pass 'owner'.`);
        }
        const transportData = buildTransportData(found.request, includeObjects, includeTasks);
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                transport_number: trNumber,
                resolved_via: resolvedVia,
                view_type: found.viewType,
                owner_scope: usedOwner,
                ...transportData,
                message: `Transport ${trNumber} retrieved successfully (${resolvedVia} read, ${found.viewType} view)`,
            }, null, 2),
            status: lastResponse.status,
            statusText: lastResponse.statusText,
            headers: lastResponse.headers,
            config: lastResponse.config,
        });
    }
    catch (error) {
        if (error instanceof utils_1.McpError) {
            throw error;
        }
        return (0, utils_1.return_error)(error);
    }
}
//# sourceMappingURL=handleGetTransport.js.map