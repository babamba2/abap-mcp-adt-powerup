"use strict";
/**
 * resolveAdtUri — powerup-local URI resolver for ABAP objects used by
 * activation / where-used / object-ref flows.
 *
 * Why this exists
 * ---------------
 * adt-clients v3.10.2's `buildObjectUri` (utils/activationUtils.js) is not
 * re-exported from the package's top-level entry, and in any case it doesn't
 * cover some object types we ship handlers for — most notably `PROG/I`
 * (stand-alone include programs) and `FUGR/I` (function-group includes).
 * For missing types its default fallback builds an invalid URI like
 * `/sap/bc/adt/prog/i/{name}` which SAP rejects with 404.
 *
 * This helper owns the URI mapping for the object types powerup's
 * high-level activation flow actually reaches. Callers are free to pass an
 * explicit `uri` — that always wins. The local map is only consulted when
 * the caller left `uri` blank.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAdtUri = resolveAdtUri;
const utils_1 = require("./utils");
/**
 * Resolve the canonical ADT URI for an object. Explicit `uri` input wins.
 *
 * The local table covers every object type that powerup's activation path
 * may have to encode. If a new type surfaces, add it here rather than
 * relying on a name-heuristic fallback.
 */
function resolveAdtUri(args) {
    if (args.uri && args.uri.trim().length > 0) {
        return args.uri;
    }
    const name = args.name;
    if (!name) {
        throw new Error('resolveAdtUri: name is required when uri is not given');
    }
    const type = (args.type ?? '').toUpperCase();
    const lowerName = (0, utils_1.encodeSapObjectName)(name).toLowerCase();
    switch (type) {
        // ── Programs ──────────────────────────────────────────────────────
        case 'PROG':
        case 'PROG/P':
            return `/sap/bc/adt/programs/programs/${lowerName}`;
        case 'PROG/I':
        case 'PROGI':
            return `/sap/bc/adt/programs/includes/${lowerName}`;
        // ── Function groups ──────────────────────────────────────────────
        case 'FUGR':
        case 'FUGR/F':
        case 'FUNC':
            return `/sap/bc/adt/functions/groups/${lowerName}`;
        case 'FUGR/FF':
            if (!args.parentName) {
                throw new Error(`resolveAdtUri: FUGR/FF for ${name} requires parentName (function-group name)`);
            }
            return `/sap/bc/adt/functions/groups/${(0, utils_1.encodeSapObjectName)(args.parentName).toLowerCase()}/fmodules/${lowerName}`;
        case 'FUGR/I':
            if (!args.parentName) {
                throw new Error(`resolveAdtUri: FUGR/I for ${name} requires parentName (function-group name)`);
            }
            return `/sap/bc/adt/functions/groups/${(0, utils_1.encodeSapObjectName)(args.parentName).toLowerCase()}/includes/${lowerName}`;
        // ── Object-oriented (classes & interfaces) ───────────────────────
        case 'CLAS':
        case 'CLAS/OC':
            return `/sap/bc/adt/oo/classes/${lowerName}`;
        case 'INTF':
        case 'INTF/OI':
            return `/sap/bc/adt/oo/interfaces/${lowerName}`;
        // ── DDIC ─────────────────────────────────────────────────────────
        case 'TABL':
        case 'TABL/DT':
            return `/sap/bc/adt/ddic/tables/${lowerName}`;
        case 'STRU':
        case 'STRU/DS':
        case 'TABL/DS':
            return `/sap/bc/adt/ddic/structures/${lowerName}`;
        case 'VIEW':
        case 'VIEW/DV':
            return `/sap/bc/adt/ddic/views/${lowerName}`;
        case 'DTEL':
        case 'DTEL/DE':
            return `/sap/bc/adt/ddic/dataelements/${lowerName}`;
        case 'DOMA':
        case 'DOMA/DD':
            return `/sap/bc/adt/ddic/domains/${lowerName}`;
        case 'TTYP':
        case 'TTYP/DF':
        case 'TTYP/TT':
            return `/sap/bc/adt/ddic/tabletypes/${lowerName}`;
        // ── CDS / RAP ────────────────────────────────────────────────────
        case 'DDLS':
        case 'DDLS/DF':
            return `/sap/bc/adt/ddic/ddl/sources/${lowerName}`;
        case 'DDLX':
        case 'DDLX/EX':
            return `/sap/bc/adt/ddic/ddlx/sources/${lowerName}`;
        case 'BDEF':
        case 'BDEF/BDO':
            return `/sap/bc/adt/ddic/bdef/sources/${lowerName}`;
        case 'DCLS':
        case 'DCLS/DL':
            return `/sap/bc/adt/acm/dcl/sources/${lowerName}`;
        case 'SRVD':
        case 'SRVD/SRV':
            return `/sap/bc/adt/ddic/srvd/sources/${lowerName}`;
        case 'SRVB':
        case 'SRVB/SVB':
            return `/sap/bc/adt/businessservices/bindings/${lowerName}`;
        // ── Enhancements ─────────────────────────────────────────────────
        case 'ENHO':
        case 'ENHO/ENH':
            return `/sap/bc/adt/enhancements/${lowerName}`;
        default:
            // Fail loudly — silent name-heuristic fallbacks silently produce
            // wrong URIs that surface only at SAP with unhelpful 404s.
            throw new Error(`resolveAdtUri: no URI mapping for type="${args.type}" (object="${name}"). ` +
                `Supply an explicit "uri" in the tool input, or add this type to resolveAdtUri.ts.`);
    }
}
//# sourceMappingURL=resolveAdtUri.js.map