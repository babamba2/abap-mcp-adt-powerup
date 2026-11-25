"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetObjectVersionSource = handleGetObjectVersionSource;
const objectVersions_1 = require("../../../lib/objectVersions");
exports.TOOL_DEFINITION = {
    name: 'GetObjectVersionSource',
    available_in: ['onprem', 'legacy'],
    description: '[read-only] Read the source of one earlier version of an ABAP object. Pass the content_uri from GetObjectVersions, or the object plus its version number (the version list is read first). Compare it with the current source (GetProgram / GetClass …) to see what a transport changed.',
    inputSchema: {
        type: 'object',
        properties: {
            content_uri: {
                type: 'string',
                description: 'content_uri of a version from GetObjectVersions (wins over the object fields).',
            },
            object_type: {
                type: 'string',
                description: 'PROG/P, PROG/I, CLAS/OC, INTF/OI or FUGR/FF (with version).',
            },
            object_name: {
                type: 'string',
                description: 'Object name (with version).',
            },
            function_group: {
                type: 'string',
                description: 'Function group of a function module.',
            },
            class_include: {
                type: 'string',
                enum: [...objectVersions_1.CLASS_INCLUDES],
                description: 'Class part (default main).',
            },
            version: {
                type: 'string',
                description: 'Version number as listed, e.g. 00003 or 3.',
            },
        },
    },
};
/**
 * Returns the source text of one version.
 * @param args content_uri, or object_type + object_name (+ function_group / class_include) + version
 */
async function handleGetObjectVersionSource(context, args) {
    const { connection } = context;
    try {
        let uri = String(args?.content_uri ?? '').trim();
        let meta = {};
        if (!uri) {
            const version = String(args?.version ?? '').trim();
            if (!args?.object_type || !args?.object_name || !version) {
                throw new Error('pass content_uri, or object_type + object_name + version');
            }
            const target = {
                object_type: String(args.object_type),
                object_name: String(args.object_name),
                function_group: args.function_group
                    ? String(args.function_group)
                    : undefined,
                class_include: args.class_include
                    ? String(args.class_include)
                    : undefined,
            };
            let list;
            try {
                list = await (0, objectVersions_1.readVersionsFeed)(connection, target);
            }
            catch (e) {
                if (!(0, objectVersions_1.isFeedMissing)(e))
                    throw e;
                throw new Error(`this system has no ADT version feed for the object (${e?.message ?? e}), so version sources cannot be read here; GetObjectVersions still lists them from VRSD`);
            }
            const hit = list.find((v) => Number(v.version) === Number(version));
            if (!hit)
                throw new Error(`version ${version} not found (versions: ${list.map((v) => v.version).join(', ') || 'none'})`);
            if (!hit.content_uri)
                throw new Error(`version ${version} has no content link in the version feed`);
            uri = hit.content_uri;
            meta = { ...hit };
        }
        else if (!(0, objectVersions_1.isVersionContentUri)(uri)) {
            throw new Error(`content_uri must be a version content URI from GetObjectVersions (…/versions/…/content), got ${uri}`);
        }
        const source = await (0, objectVersions_1.readVersionSource)(connection, uri);
        const payload = {
            content_uri: uri,
            ...meta,
            lines: source === '' ? 0 : source.replace(/\r?\n$/, '').split(/\r?\n/).length,
            source,
        };
        return {
            isError: false,
            content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        };
    }
    catch (e) {
        return {
            isError: true,
            content: [
                {
                    type: 'text',
                    text: `GetObjectVersionSource failed: ${e?.message ?? String(e)}`,
                },
            ],
        };
    }
}
//# sourceMappingURL=handleGetObjectVersionSource.js.map