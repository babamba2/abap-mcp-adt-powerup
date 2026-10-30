"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITION = void 0;
exports.handleReadProgram = handleReadProgram;
const clients_1 = require("../../../lib/clients");
const utils_1 = require("../../../lib/utils");
exports.TOOL_DEFINITION = {
    name: 'ReadProgram',
    available_in: ['onprem', 'legacy'],
    description: '[read-only] Read ABAP program or include source code and metadata (package, responsible, description, etc.). The result carries object_type PROG/P or PROG/I; an unknown name returns an error.',
    inputSchema: {
        type: 'object',
        properties: {
            program_name: {
                type: 'string',
                description: 'Program name (e.g., Z_MY_PROGRAM).',
            },
            version: {
                type: 'string',
                enum: ['active', 'inactive'],
                description: 'Version to read: "active" (default) or "inactive".',
                default: 'active',
            },
        },
        required: ['program_name'],
    },
};
async function handleReadProgram(context, args) {
    const { connection, logger } = context;
    try {
        const { program_name, version = 'active' } = args;
        if (!program_name)
            return (0, utils_1.return_error)(new Error('program_name is required'));
        const client = (0, clients_1.createAdtClient)(connection, logger);
        const programName = program_name.toUpperCase();
        const obj = client.getProgram();
        let source_code = null;
        try {
            const readResult = await obj.read({ programName }, version);
            if (readResult?.readResult?.data) {
                source_code =
                    typeof readResult.readResult.data === 'string'
                        ? readResult.readResult.data
                        : safeStringify(readResult.readResult.data);
            }
        }
        catch (e) {
            logger?.warn(`Could not read source for ${programName}: ${e?.message}`);
        }
        let metadata = null;
        try {
            const metaResult = await obj.readMetadata({ programName });
            if (metaResult?.metadataResult?.data) {
                metadata =
                    typeof metaResult.metadataResult.data === 'string'
                        ? metaResult.metadataResult.data
                        : safeStringify(metaResult.metadataResult.data);
            }
        }
        catch (e) {
            logger?.warn(`Could not read metadata for ${programName}: ${e?.message}`);
        }
        // Includes (PROG/I) live under /programs/includes/, so the program reads above
        // both fail for them. Retry there instead of reporting success with null fields.
        let object_type = 'PROG/P';
        if (source_code === null && metadata === null) {
            const base = `/sap/bc/adt/programs/includes/${(0, utils_1.encodeSapObjectName)(programName)}`;
            try {
                const src = await (0, utils_1.makeAdtRequestWithTimeout)(connection, `${base}/source/main`, 'GET', 'default', undefined, { version });
                source_code =
                    typeof src.data === 'string' ? src.data : safeStringify(src.data);
                object_type = 'PROG/I';
            }
            catch (e) {
                logger?.warn(`Could not read include source for ${programName}: ${e?.message}`);
            }
            if (object_type === 'PROG/I') {
                try {
                    const meta = await (0, utils_1.makeAdtRequestWithTimeout)(connection, base, 'GET', 'default');
                    metadata =
                        typeof meta.data === 'string'
                            ? meta.data
                            : safeStringify(meta.data);
                }
                catch (e) {
                    logger?.warn(`Could not read include metadata for ${programName}: ${e?.message}`);
                }
            }
        }
        if (source_code === null && metadata === null) {
            return (0, utils_1.return_error)(new Error(`Program or include ${programName} not found (version ${version}).`));
        }
        return (0, utils_1.return_response)({
            data: JSON.stringify({
                success: true,
                program_name: programName,
                object_type,
                version,
                source_code,
                metadata,
            }, null, 2),
        });
    }
    catch (error) {
        return (0, utils_1.return_error)(error);
    }
}
function safeStringify(data) {
    try {
        return JSON.stringify(data);
    }
    catch {
        return String(data);
    }
}
//# sourceMappingURL=handleReadProgram.js.map