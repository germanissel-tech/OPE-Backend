// GENERADO por scripts/contract-types.mjs desde contracts/dist/openapi.yaml — NO EDITAR A MANO.
// Regenerar con: npm run contract:types

export type paths = {
    "/v1/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Estado del servicio
         * @description Devuelve el estado del servicio, la versión del contrato con la que está corriendo y la
         *     marca de tiempo del instante de la respuesta. No requiere autenticación. No declara
         *     parámetros: cualquier parámetro de query se rechaza con `400`.
         */
        get: operations["getHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
};
export type webhooks = Record<string, never>;
export type components = {
    schemas: {
        /** @description Estado del servicio. */
        Health: {
            /** @description Versión semántica del contrato OpenAPI que el servidor cargó al arrancar. */
            contractVersion: string;
            /**
             * @description `ok` cuando el servicio puede atender requests. `degraded` queda reservado para cuando existan dependencias externas cuya caída no impida responder.
             * @enum {string}
             */
            status: "ok" | "degraded";
            /**
             * Format: date-time
             * @description Instante UTC en que se produjo la respuesta (RFC 3339).
             */
            timestamp: string;
        };
        /** @description Error según RFC 9457 (Problem Details for HTTP APIs). Toda respuesta 4xx/5xx de la API usa este esquema con el tipo de contenido `application/problem+json`. Los valores de `type` pertenecen al catálogo `contracts/problem-types.yaml` (URN `urn:ope:problem:<slug>`). */
        ProblemDetails: {
            /** @description Explicación legible de esta ocurrencia. Nunca incluye detalles internos. */
            detail?: string;
            /** @description Violaciones individuales del contrato. Presente sólo en `400` y `422`. */
            errors?: {
                /** @description Descripción de la violación. */
                message: string;
                /** @description JSON Pointer relativo al request (`/query/foo`, `/body/kind`, `/headers/x`). */
                pointer: string;
            }[];
            /** @description Referencia URI de la ocurrencia; habitualmente el path del request. */
            instance?: string;
            /** @description Código de estado HTTP de la respuesta, repetido en el cuerpo. */
            status: number;
            /** @description Resumen corto y fijo para el tipo de problema. */
            title: string;
            /**
             * Format: uri
             * @description Identificador estable del tipo de problema, del catálogo de OPE.
             */
            type: string;
        };
    };
    responses: {
        /** @description Parámetro, header o campo desconocido, ausente o con tipo inválido. `errors` enumera cada violación; el manejador no se invocó. */
        BadRequest: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:ope:problem:validation-failed",
                 *       "title": "El request no cumple el contrato",
                 *       "status": 400,
                 *       "instance": "/v1/health"
                 *     }
                 */
                "application/problem+json": components["schemas"]["ProblemDetails"];
            };
        };
        /** @description Falla interna, excepción no controlada o respuesta del manejador que no cumple el contrato. No expone detalles internos. */
        InternalServerError: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:ope:problem:internal-error",
                 *       "title": "Error interno",
                 *       "status": 500,
                 *       "instance": "/v1/health"
                 *     }
                 */
                "application/problem+json": components["schemas"]["ProblemDetails"];
            };
        };
    };
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
};
export type $defs = Record<string, never>;
export interface operations {
    getHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description El servicio está operativo. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Health"];
                };
            };
            400: components["responses"]["BadRequest"];
            500: components["responses"]["InternalServerError"];
        };
    };
}
