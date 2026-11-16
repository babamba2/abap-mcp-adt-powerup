"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_VALUES_BYTES = void 0;
exports.valuesRoots = valuesRoots;
exports.readValuesFile = readValuesFile;
/**
 * The `values_file` of the form render tools (RenderSmartForm, RenderAdobeForm):
 * a JSON file of invented sample values that is sent to SAP whole.
 *
 * The path comes from the model, so it is confined like an output path:
 * - real path (symlinks / junctions resolved) inside the MCP output directory
 *   or, for the sc4sap layout `<cwd>/.sc4sap/work/<alias>/mcp-output`, inside
 *   the profile's work folder `<cwd>/.sc4sap/work/<alias>`;
 * - no UNC / device paths, `.json` files only, nothing that looks like a
 *   secret (env files, profiles, config.json, keychain, token, credential,
 *   secret, password, key files);
 * - at most MAX_VALUES_BYTES;
 * - a parse error never shows the file's content.
 */
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const sourceOutput_1 = require("./sourceOutput");
exports.MAX_VALUES_BYTES = 1024 * 1024;
// one message for a missing file and a file outside the allowed folders: the answer must not tell whether
// a file exists somewhere else
const NOT_ALLOWED = 'values_file: refused — no such .json file inside the MCP output directory or the profile work folder';
const SECRET_SEGMENT = /(^|[\\/])(\.env[^\\/]*|[^\\/]*\.env|sap\.env[^\\/]*|profiles?|config\.json|[^\\/]*keychain[^\\/]*|[^\\/]*token[^\\/]*|[^\\/]*credential[^\\/]*|[^\\/]*secret[^\\/]*|[^\\/]*passw[^\\/]*|[^\\/]*\.(pem|key|pfx|p12))([\\/]|$)/i;
/** Folders a values file may live in (real paths of those that exist). */
function valuesRoots() {
    const out = (0, sourceOutput_1.outputRoot)();
    const roots = [out];
    // sc4sap: <cwd>/.sc4sap/work/<alias>/mcp-output → also <cwd>/.sc4sap/work/<alias>
    const parent = path.dirname(out);
    if (path.basename(out) === 'mcp-output' &&
        path.basename(path.dirname(parent)) === 'work' &&
        path.basename(path.dirname(path.dirname(parent))) === '.sc4sap')
        roots.push(parent);
    const real = [];
    for (const r of roots) {
        try {
            real.push(fs.realpathSync(r));
        }
        catch {
            /* not created yet: nothing can live in it */
        }
    }
    return real;
}
const inside = (root, p) => {
    const rel = path.relative(root, p);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
};
/** Read and parse a values file under the rules above; throws a short error otherwise. */
function readValuesFile(file) {
    const p = String(file ?? '').trim();
    if (!p)
        throw new Error('values_file: empty path');
    if (/^(\\\\|\/\/)/.test(p) || /^\\\\\?\\/.test(p) || /^[a-z]:[^\\/]/i.test(p))
        throw new Error('values_file: UNC and device paths are not allowed');
    if (SECRET_SEGMENT.test(p))
        throw new Error('values_file: refused (the path looks like a secret or profile file)');
    if (path.extname(p).toLowerCase() !== '.json')
        throw new Error('values_file: a .json file is expected');
    const roots = valuesRoots();
    if (!roots.length)
        throw new Error('values_file: the MCP output directory does not exist yet');
    let real;
    try {
        real = fs.realpathSync(path.resolve(roots[0], p));
    }
    catch {
        throw new Error(NOT_ALLOWED);
    }
    if (!roots.some((r) => inside(r, real)))
        throw new Error(NOT_ALLOWED);
    if (SECRET_SEGMENT.test(real))
        throw new Error('values_file: refused (the path looks like a secret or profile file)');
    const st = fs.statSync(real);
    if (!st.isFile())
        throw new Error('values_file: not a file');
    if (st.size > exports.MAX_VALUES_BYTES)
        throw new Error(`values_file: larger than ${exports.MAX_VALUES_BYTES} bytes`);
    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(real, 'utf8'));
    }
    catch {
        throw new Error('values_file is not valid JSON');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error('values_file: a JSON object of parameter values is expected');
    return parsed;
}
//# sourceMappingURL=valuesFile.js.map