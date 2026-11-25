"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleGetObjectVersions = handleGetObjectVersions;
const objectVersions_1 = require("../../../lib/objectVersions");
exports.TOOL_DEFINITION = {
    name: 'GetObjectVersions',
    available_in: ['onprem', 'legacy'],
    description: '[read-only] List the source versions of an ABAP object (SE38 / SE80 "Versions"): version number, date, author, transport request, and the content_uri that GetObjectVersionSource reads. Programs, includes, classes (one part at a time), interfaces, function modules. Uses the ADT revision feed; on a system without it, falls back to the version directory VRSD (list only, no content_uri).',
    inputSchema: {
        type: 'object',
        properties: {
            object_type: {
                type: 'string',
                description: `One of ${objectVersions_1.VERSIONED_TYPES.join(', ')} (PROG, INCLUDE, CLAS, INTF, FUNC also accepted).`,
            },
            object_name: {
                type: 'string',
                description: 'Object name, e.g. ZSDR0001',
            },
            function_group: {
                type: 'string',
                description: 'Function group — required for a function module (FUGR/FF).',
            },
            class_include: {
                type: 'string',
                enum: [...objectVersions_1.CLASS_INCLUDES],
                description: 'Class part for CLAS/OC (default main).',
            },
            max_versions: {
                type: 'number',
                description: 'Newest N versions (default 50).',
            },
        },
        required: ['object_type', 'object_name'],
    },
};
const DEFAULT_MAX = 50;
/**
 * Lists the versions of one object's source, newest first.
 * @param args object_type, object_name, function_group?, class_include?, max_versions?
 */
async function handleGetObjectVersions(context, args) {
    const { connection, logger } = context;
    const target = {
        object_type: String(args?.object_type ?? ''),
        object_name: String(args?.object_name ?? '').trim(),
        function_group: args?.function_group
            ? String(args.function_group)
            : undefined,
        class_include: args?.class_include ? String(args.class_include) : undefined,
    };
    const max = Math.max(1, Math.min(500, Number(args?.max_versions) || DEFAULT_MAX));
    try {
        if (!target.object_name)
            throw new Error('object_name is required');
        const uri = (0, objectVersions_1.versionsUri)(target); // validates type / parents before any call
        let versions;
        let source = 'adt';
        let note = '';
        try {
            versions = await (0, objectVersions_1.readVersionsFeed)(connection, target);
        }
        catch (e) {
            if (!(0, objectVersions_1.isFeedMissing)(e))
                throw e;
            logger?.info(`GetObjectVersions: no ADT version feed (${e.message}); reading VRSD`);
            versions = await (0, objectVersions_1.readVersionsVrsd)(connection, target);
            source = 'vrsd';
            note =
                versions.length === 0
                    ? 'No ADT version feed was found and VRSD has no versions under this name: check the object name and type (a misspelt name looks the same as a system without the feed).'
                    : 'This system has no ADT version feed for the object: the list comes from VRSD and has no content_uri, so GetObjectVersionSource cannot read these versions here.';
            if (versions.length > 0 && (0, objectVersions_1.normaliseType)(target.object_type) === 'CLAS/OC')
                note +=
                    ' For a class, VRSD lists the class definition (CLSD) versions whatever class_include says; method versions are separate (METH).';
        }
        const payload = {
            object_type: target.object_type,
            object_name: target.object_name.toUpperCase(),
            ...(target.function_group
                ? { function_group: target.function_group.toUpperCase() }
                : {}),
            ...(target.class_include ? { class_include: target.class_include } : {}),
            source,
            feed_uri: uri,
            total: versions.length,
            truncated: versions.length > max,
            versions: versions.slice(0, max),
            ...(note ? { note } : {}),
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
                    text: `GetObjectVersions failed: ${e?.message ?? String(e)}`,
                },
            ],
        };
    }
}
//# sourceMappingURL=handleGetObjectVersions.js.map