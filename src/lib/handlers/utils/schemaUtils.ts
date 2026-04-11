import * as z from 'zod';

/**
 * Lenient boolean schema that accepts JSON booleans AND the common
 * string forms `"true"` / `"false"` (any case). Some MCP clients
 * (notably the Claude Code in-process tool bridge) stringify boolean
 * arguments before they reach the Zod validator, which used to cause
 * `Invalid input: expected boolean, received string` errors on every
 * `activate: true` style call. Using `z.preprocess` here keeps strict
 * boolean semantics for everything else (numbers, "yes", etc. are
 * still rejected) while normalizing the only two ambiguous string
 * forms we actually see in practice.
 */
function lenientBoolean(): z.ZodType<boolean> {
  return z.preprocess((value) => {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
    return value;
  }, z.boolean()) as unknown as z.ZodType<boolean>;
}

/**
 * Converts JSON Schema to Zod schema object (not z.object(), but object with Zod fields)
 * SDK expects inputSchema to be an object with Zod schemas as values, not z.object()
 */
export function jsonSchemaToZod(jsonSchema: any): any {
  // If already a Zod schema object (object with Zod fields), return as-is
  if (
    jsonSchema &&
    typeof jsonSchema === 'object' &&
    !jsonSchema.type &&
    !jsonSchema.properties
  ) {
    // Check if it looks like a Zod schema object (has Zod types as values)
    const firstValue = Object.values(jsonSchema)[0];
    if (
      firstValue &&
      ((firstValue as any).def ||
        (firstValue as any)._def ||
        typeof (firstValue as any).parse === 'function')
    ) {
      return jsonSchema;
    }
  }

  // If it's a JSON Schema object
  if (
    jsonSchema &&
    typeof jsonSchema === 'object' &&
    jsonSchema.type === 'object' &&
    jsonSchema.properties
  ) {
    const zodShape: Record<string, z.ZodTypeAny> = {};
    const required = jsonSchema.required || [];

    for (const [key, prop] of Object.entries(jsonSchema.properties)) {
      const propSchema = prop as any;
      let zodType: z.ZodTypeAny;

      if (propSchema.type === 'string') {
        if (
          propSchema.enum &&
          Array.isArray(propSchema.enum) &&
          propSchema.enum.length > 0
        ) {
          // Use z.enum() for enum values (requires at least 1 element, but z.enum needs 2+)
          if (propSchema.enum.length === 1) {
            zodType = z.literal(propSchema.enum[0]);
          } else {
            zodType = z.enum(propSchema.enum as [string, ...string[]]);
          }
        } else {
          zodType = z.string();
        }
      } else if (
        propSchema.type === 'number' ||
        propSchema.type === 'integer'
      ) {
        zodType = z.number();
      } else if (propSchema.type === 'boolean') {
        zodType = lenientBoolean();
      } else if (propSchema.type === 'array') {
        const items = propSchema.items;
        if (items?.type === 'string') {
          zodType = z.array(z.string());
        } else if (items?.type === 'number' || items?.type === 'integer') {
          zodType = z.array(z.number());
        } else if (items?.type === 'boolean') {
          zodType = z.array(lenientBoolean());
        } else if (items?.type === 'object' && items.properties) {
          // For nested objects in arrays, create object schema
          const nestedShape: Record<string, z.ZodTypeAny> = {};
          const nestedRequired = items.required || [];
          for (const [nestedKey, nestedProp] of Object.entries(
            items.properties,
          )) {
            const nestedPropSchema = nestedProp as any;
            let nestedZodType: z.ZodTypeAny;
            if (nestedPropSchema.type === 'string') {
              if (
                nestedPropSchema.enum &&
                Array.isArray(nestedPropSchema.enum) &&
                nestedPropSchema.enum.length > 0
              ) {
                if (nestedPropSchema.enum.length === 1) {
                  nestedZodType = z.literal(nestedPropSchema.enum[0]);
                } else {
                  nestedZodType = z.enum(
                    nestedPropSchema.enum as [string, ...string[]],
                  );
                }
              } else {
                nestedZodType = z.string();
              }
            } else if (
              nestedPropSchema.type === 'number' ||
              nestedPropSchema.type === 'integer'
            ) {
              nestedZodType = z.number();
            } else if (nestedPropSchema.type === 'boolean') {
              nestedZodType = lenientBoolean();
            } else {
              nestedZodType = z.any();
            }
            if (nestedPropSchema.default !== undefined) {
              nestedZodType = nestedZodType.default(nestedPropSchema.default);
            }
            if (!nestedRequired.includes(nestedKey)) {
              nestedZodType = nestedZodType.optional();
            }
            if (nestedPropSchema.description) {
              nestedZodType = nestedZodType.describe(
                nestedPropSchema.description,
              );
            }
            nestedShape[nestedKey] = nestedZodType;
          }
          zodType = z.array(z.object(nestedShape));
        } else {
          zodType = z.array(z.any());
        }
      } else if (propSchema.type === 'object' && propSchema.properties) {
        // For nested objects, create object schema
        const nestedShape: Record<string, z.ZodTypeAny> = {};
        const nestedRequired = propSchema.required || [];
        for (const [nestedKey, nestedProp] of Object.entries(
          propSchema.properties,
        )) {
          const nestedPropSchema = nestedProp as any;
          let nestedZodType: z.ZodTypeAny;
          if (nestedPropSchema.type === 'string') {
            if (nestedPropSchema.enum && Array.isArray(nestedPropSchema.enum)) {
              nestedZodType = z.enum(
                nestedPropSchema.enum as [string, ...string[]],
              );
            } else {
              nestedZodType = z.string();
            }
          } else if (
            nestedPropSchema.type === 'number' ||
            nestedPropSchema.type === 'integer'
          ) {
            nestedZodType = z.number();
          } else if (nestedPropSchema.type === 'boolean') {
            nestedZodType = lenientBoolean();
          } else {
            nestedZodType = z.any();
          }
          if (nestedPropSchema.default !== undefined) {
            nestedZodType = nestedZodType.default(nestedPropSchema.default);
          }
          if (!nestedRequired.includes(nestedKey)) {
            nestedZodType = nestedZodType.optional();
          }
          if (nestedPropSchema.description) {
            nestedZodType = nestedZodType.describe(
              nestedPropSchema.description,
            );
          }
          nestedShape[nestedKey] = nestedZodType;
        }
        zodType = z.object(nestedShape);
      } else {
        zodType = z.any();
      }

      // Add default value if present (before optional)
      if (propSchema.default !== undefined) {
        zodType = zodType.default(propSchema.default);
      }

      // Make optional if not in required array (must be after default, before describe)
      if (!required.includes(key)) {
        zodType = zodType.optional();
      }

      // Add description if present (after optional)
      if (propSchema.description) {
        zodType = zodType.describe(propSchema.description);
      }

      zodShape[key] = zodType;
    }

    // Return object with Zod fields, not z.object()
    return zodShape;
  }

  // Fallback: if it's already a Zod schema object, return as-is
  if (jsonSchema && typeof jsonSchema === 'object' && !jsonSchema.type) {
    return jsonSchema;
  }

  // Fallback: return empty object for unknown schemas
  return {};
}
