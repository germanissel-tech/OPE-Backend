// GENERADO por scripts/contract-types.mjs desde contracts/dist/openapi.yaml — NO EDITAR A MANO.
// Regenerar con: npm run contract:types

export type paths = {
    "/v1/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Ingesta de un lote de eventos del SDK
         * @description Recibe un lote de eventos de comportamiento de **una** sesión, identificado el merchant por la
         *     credencial de ingesta. Valida contra la lista blanca (cualquier campo no declarado rechaza
         *     el lote entero con `400`), deduplica por `eventId` dentro del merchant (ventana: 24 horas o
         *     100.000 eventos por merchant, lo que ocurra antes, en el perfil en memoria) y devuelve la
         *     decisión para la sesión. Un lote rechazado no produce decisión.
         *
         *     Nada fuera de la lista blanca se registra ni se escribe en logs; la dirección IP no se
         *     persiste (01-arquitectura-mvp.md §10.2).
         */
        post: operations["ingestEvents"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/exposures": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Confirmación de exposición de una intervención
         * @description El SDK confirma que la intervención de una decisión se renderizó y fue visible. Sólo entonces
         *     existe una exposición (estado `EXPOSED` de la cadena de evidencia, 01 §5); la decisión sola no
         *     la implica. La decisión tiene que existir para el merchant de la credencial y haber sido una
         *     intervención. Una confirmación repetida no duplica el registro.
         */
        post: operations["confirmExposure"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
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
        /** @description Agregado al carrito. */
        AddedToCart: {
            device: components["schemas"]["DeviceClass"];
            eventId: components["schemas"]["EventId"];
            /**
             * Format: date-time
             * @description Instante del evento según el navegador (RFC 3339). Tolerancia aceptada: hasta 5 minutos a futuro y 24 horas a pasado respecto del reloj del backend; fuera de eso, `event-timestamp-out-of-range`.
             */
            occurredAt: string;
            page: components["schemas"]["PageContext"];
            /** @description Unidades agregadas. */
            quantity: number;
            sessionId: components["schemas"]["SessionId"];
            /**
             * @description Discriminador del tipo de evento. (enum property replaced by openapi-typescript)
             * @enum {string}
             */
            type: "added_to_cart";
            visitorId: components["schemas"]["VisitorId"];
        };
        /**
         * @description Punto de anclaje semántico donde se renderiza (o se renderizó) una intervención. El SDK lo resuelve con el mapa de anclajes del merchant.
         * @enum {string}
         */
        Anchor: "size_selector" | "price" | "cta" | "policies";
        /** @description Scroll y permanencia sobre un bloque de la ficha. */
        BlockDwelled: {
            /**
             * @description Bloque semántico de la ficha sobre el que se detuvo.
             * @enum {string}
             */
            block: "description" | "size_guide" | "reviews" | "policies" | "price" | "gallery" | "cta";
            device: components["schemas"]["DeviceClass"];
            /** @description Milisegundos de permanencia sobre el bloque. */
            dwellMs: number;
            eventId: components["schemas"]["EventId"];
            /**
             * Format: date-time
             * @description Instante del evento según el navegador (RFC 3339). Tolerancia aceptada: hasta 5 minutos a futuro y 24 horas a pasado respecto del reloj del backend; fuera de eso, `event-timestamp-out-of-range`.
             */
            occurredAt: string;
            page: components["schemas"]["PageContext"];
            sessionId: components["schemas"]["SessionId"];
            /**
             * @description Discriminador del tipo de evento. (enum property replaced by openapi-typescript)
             * @enum {string}
             */
            type: "block_dwelled";
            visitorId: components["schemas"]["VisitorId"];
        };
        /** @description Avance de checkout. OPE observa la transición para inferir y medir; no interviene ahí. */
        CheckoutAdvanced: {
            device: components["schemas"]["DeviceClass"];
            eventId: components["schemas"]["EventId"];
            /**
             * Format: date-time
             * @description Instante del evento según el navegador (RFC 3339). Tolerancia aceptada: hasta 5 minutos a futuro y 24 horas a pasado respecto del reloj del backend; fuera de eso, `event-timestamp-out-of-range`.
             */
            occurredAt: string;
            page: components["schemas"]["PageContext"];
            sessionId: components["schemas"]["SessionId"];
            /**
             * @description Paso alcanzado.
             * @enum {string}
             */
            step: "cart" | "checkout_started" | "shipping" | "payment" | "review";
            /**
             * @description Discriminador del tipo de evento. (enum property replaced by openapi-typescript)
             * @enum {string}
             */
            type: "checkout_advanced";
            visitorId: components["schemas"]["VisitorId"];
        };
        /** @description Hover o acercamiento al llamado a la acción de compra. */
        CtaApproached: {
            /**
             * @description Forma del acercamiento al CTA.
             * @enum {string}
             */
            approach: "hover" | "near";
            device: components["schemas"]["DeviceClass"];
            eventId: components["schemas"]["EventId"];
            /**
             * Format: date-time
             * @description Instante del evento según el navegador (RFC 3339). Tolerancia aceptada: hasta 5 minutos a futuro y 24 horas a pasado respecto del reloj del backend; fuera de eso, `event-timestamp-out-of-range`.
             */
            occurredAt: string;
            page: components["schemas"]["PageContext"];
            sessionId: components["schemas"]["SessionId"];
            /**
             * @description Discriminador del tipo de evento. (enum property replaced by openapi-typescript)
             * @enum {string}
             */
            type: "cta_approached";
            visitorId: components["schemas"]["VisitorId"];
        };
        /**
         * @description La decisión de OPE para la sesión tras procesar el lote. Siempre existe: no intervenir es un
         *     resultado con motivo, nunca una ausencia (constitución II). `reason` es un string del catálogo
         *     `contracts/no-op-reasons.yaml`; el catálogo se amplía sin cambio incompatible (por eso no es enum).
         */
        Decision: {
            decisionId: components["schemas"]["DecisionId"];
            intervention?: components["schemas"]["Intervention"];
            /**
             * @description `NO_OP`: no intervenir. `INTERVENE` queda reservado para el plano de decisión (PROPUESTO).
             * @enum {string}
             */
            outcome: "NO_OP" | "INTERVENE";
            /** @description Motivo del resultado, del catálogo `contracts/no-op-reasons.yaml` (por ejemplo `decision-plane-unavailable`). */
            reason: string;
            sessionId: components["schemas"]["SessionId"];
        };
        /** @description Identificador de una decisión emitida por OPE. Lo genera el backend y lo cita el SDK al confirmar una exposición. */
        DecisionId: string;
        /**
         * @description Clase de dispositivo, sólo para layout. Nunca una huella identificatoria (01 §10.2).
         * @enum {string}
         */
        DeviceClass: "desktop" | "mobile" | "tablet";
        /**
         * @description Un evento de comportamiento del SDK. Lista blanca cerrada (03-alcance-mvp.md §4.1): un tipo
         *     fuera de esta unión o un campo no declarado rechazan el lote entero (01 §10.3).
         *     El `mapping` es explícito para que los tipos generados lleven el valor de cable; el servidor
         *     lo quita antes de compilar los validadores porque Ajv no lo soporta (ADR-014).
         */
        Event: components["schemas"]["ProductViewed"] | components["schemas"]["ListingViewed"] | components["schemas"]["SizeSelectorInteracted"] | components["schemas"]["VariantSelected"] | components["schemas"]["PhotoInteracted"] | components["schemas"]["BlockDwelled"] | components["schemas"]["CtaApproached"] | components["schemas"]["ProductReturnedTo"] | components["schemas"]["AddedToCart"] | components["schemas"]["RemovedFromCart"] | components["schemas"]["CheckoutAdvanced"] | components["schemas"]["ExitSignaled"];
        /** @description Lote de eventos de **una** sesión. Todos los eventos deben pertenecer al mismo visitante (`session-visitor-mismatch` si no). */
        EventBatch: {
            /** @description Eventos en el orden en que el SDK los capturó. El orden lo da `occurredAt`, no la posición. */
            events: components["schemas"]["Event"][];
        };
        /** @description Identificador único del evento, generado por el SDK. Deduplica reintentos y replays dentro del merchant. */
        EventId: string;
        /** @description Resultado de un evento del lote. */
        EventResult: {
            eventId: components["schemas"]["EventId"];
            /**
             * @description `accepted`: entró y quedó registrado. `duplicate`: ya se había recibido para este merchant (reintento o replay); no se registra dos veces.
             * @enum {string}
             */
            status: "accepted" | "duplicate";
        };
        /** @description Señal de salida. Exactamente las cuatro de 03 §4.1; agregar una es cambio de alcance. */
        ExitSignaled: {
            device: components["schemas"]["DeviceClass"];
            eventId: components["schemas"]["EventId"];
            /**
             * Format: date-time
             * @description Instante del evento según el navegador (RFC 3339). Tolerancia aceptada: hasta 5 minutos a futuro y 24 horas a pasado respecto del reloj del backend; fuera de eso, `event-timestamp-out-of-range`.
             */
            occurredAt: string;
            page: components["schemas"]["PageContext"];
            sessionId: components["schemas"]["SessionId"];
            /**
             * @description Cuál de las cuatro señales de salida.
             * @enum {string}
             */
            signal: "inactivity" | "tab_hidden" | "back_navigation" | "exit_intent";
            /**
             * @description Discriminador del tipo de evento. (enum property replaced by openapi-typescript)
             * @enum {string}
             */
            type: "exit_signaled";
            visitorId: components["schemas"]["VisitorId"];
        };
        /** @description Confirmación del SDK de que una intervención se renderizó y fue visible. Es lo que constituye una exposición (01 §3.1), no la decisión. */
        ExposureConfirmation: {
            anchor: components["schemas"]["Anchor"];
            decisionId: components["schemas"]["DecisionId"];
            /**
             * Format: date-time
             * @description Instante en que la intervención fue visible, según el navegador.
             */
            exposedAt: string;
            sessionId: components["schemas"]["SessionId"];
            visitorId: components["schemas"]["VisitorId"];
        };
        /** @description Resultado del registro de la exposición. */
        ExposureResult: {
            decisionId: components["schemas"]["DecisionId"];
            /**
             * @description `recorded`: quedó registrada como EXPOSED. `already-recorded`: ya estaba; el registro no cambió.
             * @enum {string}
             */
            status: "recorded" | "already-recorded";
        };
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
        /** @description Respuesta a un lote aceptado. Trae el resultado por evento y la decisión para la sesión. */
        IngestResult: {
            /** @description Cantidad de eventos que entraron. */
            accepted: number;
            decision: components["schemas"]["Decision"];
            /** @description Cantidad de eventos ya recibidos antes. */
            duplicates: number;
            /** @description Un resultado por evento, en el orden del lote. */
            results: components["schemas"]["EventResult"][];
        };
        /**
         * @description PROPUESTO — Lugar reservado para la intervención que el plano de decisión emitirá en features
         *     posteriores. El equipo del SDK valida esta forma antes de la 010; hasta entonces ninguna
         *     decisión la trae (`outcome` es siempre `NO_OP`).
         */
        Intervention: {
            anchor: components["schemas"]["Anchor"];
            /** @description Versión del mensaje curado a renderizar. El texto lo sirve el catálogo de mensajes, no este contrato. */
            messageVersionId: string;
        };
        /** @description Vista de un listado o categoría. */
        ListingViewed: {
            device: components["schemas"]["DeviceClass"];
            eventId: components["schemas"]["EventId"];
            /**
             * Format: date-time
             * @description Instante del evento según el navegador (RFC 3339). Tolerancia aceptada: hasta 5 minutos a futuro y 24 horas a pasado respecto del reloj del backend; fuera de eso, `event-timestamp-out-of-range`.
             */
            occurredAt: string;
            page: components["schemas"]["PageContext"];
            sessionId: components["schemas"]["SessionId"];
            /**
             * @description Discriminador del tipo de evento. (enum property replaced by openapi-typescript)
             * @enum {string}
             */
            type: "listing_viewed";
            visitorId: components["schemas"]["VisitorId"];
        };
        /** @description Importe monetario. El monto viaja como string decimal para no perder precisión (ADR-014). */
        Money: {
            /** @description Monto con hasta dos decimales, punto como separador, sin signo ni separadores de miles. */
            amount: string;
            /** @description Moneda en ISO 4217. */
            currency: string;
        };
        /**
         * @description Lo que el SDK pudo resolver de la página en la que ocurrió el evento (01-arquitectura-mvp.md
         *     §3.1.1, `PageContext`). Todo lo que no sea `pageType` es opcional: el SDK reporta lo que resolvió
         *     y el backend falla cerrado ante un contexto incompleto (`NO_OP` con motivo `page-context-incomplete`).
         *     Lista blanca: ningún otro dato de la página entra (01 §10.2).
         */
        PageContext: {
            /**
             * @description Disponibilidad de la variante tal como la muestra la página. Guardia, no claim (01 §4.3).
             * @enum {string}
             */
            availability?: "in_stock" | "out_of_stock" | "unknown";
            /**
             * @description Tipo de página según el adaptador de plataforma del SDK.
             * @enum {string}
             */
            pageType: "product" | "listing" | "cart" | "checkout" | "other";
            price?: components["schemas"]["Money"];
            /** @description Identificador del producto en la plataforma del merchant, tal como lo expone la página. */
            productId?: string;
            /** @description Identificador de la variante seleccionada (talle + color), si hay una. */
            variantId?: string;
        };
        /** @description Zoom o navegación entre fotos del producto. */
        PhotoInteracted: {
            device: components["schemas"]["DeviceClass"];
            eventId: components["schemas"]["EventId"];
            /**
             * @description Qué hizo el visitante con las fotos.
             * @enum {string}
             */
            interaction: "zoom" | "navigate";
            /**
             * Format: date-time
             * @description Instante del evento según el navegador (RFC 3339). Tolerancia aceptada: hasta 5 minutos a futuro y 24 horas a pasado respecto del reloj del backend; fuera de eso, `event-timestamp-out-of-range`.
             */
            occurredAt: string;
            page: components["schemas"]["PageContext"];
            sessionId: components["schemas"]["SessionId"];
            /**
             * @description Discriminador del tipo de evento. (enum property replaced by openapi-typescript)
             * @enum {string}
             */
            type: "photo_interacted";
            visitorId: components["schemas"]["VisitorId"];
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
        /** @description Retorno a un producto visto antes en la sesión (comparación A → B → A). Se observa y registra; no tiene mensajes propios en el MVP. */
        ProductReturnedTo: {
            device: components["schemas"]["DeviceClass"];
            eventId: components["schemas"]["EventId"];
            /**
             * Format: date-time
             * @description Instante del evento según el navegador (RFC 3339). Tolerancia aceptada: hasta 5 minutos a futuro y 24 horas a pasado respecto del reloj del backend; fuera de eso, `event-timestamp-out-of-range`.
             */
            occurredAt: string;
            page: components["schemas"]["PageContext"];
            /** @description Producto desde el que se volvió. */
            previousProductId: string;
            sessionId: components["schemas"]["SessionId"];
            /**
             * @description Discriminador del tipo de evento. (enum property replaced by openapi-typescript)
             * @enum {string}
             */
            type: "product_returned_to";
            visitorId: components["schemas"]["VisitorId"];
        };
        /** @description Vista de una ficha de producto. */
        ProductViewed: {
            device: components["schemas"]["DeviceClass"];
            eventId: components["schemas"]["EventId"];
            /**
             * Format: date-time
             * @description Instante del evento según el navegador (RFC 3339). Tolerancia aceptada: hasta 5 minutos a futuro y 24 horas a pasado respecto del reloj del backend; fuera de eso, `event-timestamp-out-of-range`.
             */
            occurredAt: string;
            page: components["schemas"]["PageContext"];
            sessionId: components["schemas"]["SessionId"];
            /**
             * @description Discriminador del tipo de evento. (enum property replaced by openapi-typescript)
             * @enum {string}
             */
            type: "product_viewed";
            visitorId: components["schemas"]["VisitorId"];
        };
        /** @description Eliminación del carrito. El retorno a la ficha llega como `product_viewed` posterior; juntos son el amplificador de barrera (03 §4.2). */
        RemovedFromCart: {
            device: components["schemas"]["DeviceClass"];
            eventId: components["schemas"]["EventId"];
            /**
             * Format: date-time
             * @description Instante del evento según el navegador (RFC 3339). Tolerancia aceptada: hasta 5 minutos a futuro y 24 horas a pasado respecto del reloj del backend; fuera de eso, `event-timestamp-out-of-range`.
             */
            occurredAt: string;
            page: components["schemas"]["PageContext"];
            sessionId: components["schemas"]["SessionId"];
            /**
             * @description Discriminador del tipo de evento. (enum property replaced by openapi-typescript)
             * @enum {string}
             */
            type: "removed_from_cart";
            visitorId: components["schemas"]["VisitorId"];
        };
        /** @description Identificador de la visita, generado por el SDK. Agrupa la secuencia de comportamiento; expira. */
        SessionId: string;
        /** @description Interacción con el selector de talle. */
        SizeSelectorInteracted: {
            device: components["schemas"]["DeviceClass"];
            eventId: components["schemas"]["EventId"];
            /**
             * Format: date-time
             * @description Instante del evento según el navegador (RFC 3339). Tolerancia aceptada: hasta 5 minutos a futuro y 24 horas a pasado respecto del reloj del backend; fuera de eso, `event-timestamp-out-of-range`.
             */
            occurredAt: string;
            page: components["schemas"]["PageContext"];
            sessionId: components["schemas"]["SessionId"];
            /** @description Etiqueta del talle con la que se interactuó, tal como la muestra la tienda. */
            size: string;
            /**
             * @description Discriminador del tipo de evento. (enum property replaced by openapi-typescript)
             * @enum {string}
             */
            type: "size_selector_interacted";
            visitorId: components["schemas"]["VisitorId"];
        };
        /** @description Selección de color o variante. */
        VariantSelected: {
            device: components["schemas"]["DeviceClass"];
            eventId: components["schemas"]["EventId"];
            /**
             * Format: date-time
             * @description Instante del evento según el navegador (RFC 3339). Tolerancia aceptada: hasta 5 minutos a futuro y 24 horas a pasado respecto del reloj del backend; fuera de eso, `event-timestamp-out-of-range`.
             */
            occurredAt: string;
            page: components["schemas"]["PageContext"];
            /** @description Variante elegida en el selector. */
            selectedVariantId: string;
            sessionId: components["schemas"]["SessionId"];
            /**
             * @description Discriminador del tipo de evento. (enum property replaced by openapi-typescript)
             * @enum {string}
             */
            type: "variant_selected";
            visitorId: components["schemas"]["VisitorId"];
        };
        /** @description Identificador seudónimo y persistente del navegador, generado por el SDK. Da estabilidad a la asignación experimental. No identifica a una persona. */
        VisitorId: string;
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
        /** @description El lote cumple el esquema pero viola una invariante de ingesta. */
        EventBatchUnprocessable: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["ProblemDetails"];
            };
        };
        /** @description La confirmación cumple el esquema pero no puede registrarse. */
        ExposureUnprocessable: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["ProblemDetails"];
            };
        };
        /** @description La credencial es válida pero el `Origin` del navegador no está entre los orígenes registrados del merchant. */
        Forbidden: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:ope:problem:origin-not-allowed",
                 *       "title": "Origen no registrado para el merchant",
                 *       "status": 403,
                 *       "instance": "/v1/events"
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
        /** @description La operación requiere una credencial y no se presentó una válida. */
        Unauthorized: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:ope:problem:unauthorized",
                 *       "title": "Credencial ausente o inválida",
                 *       "status": 401,
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
    ingestEvents: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EventBatch"];
            };
        };
        responses: {
            /** @description Lote aceptado. Los duplicados se reportan por evento; la decisión es para la sesión. */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IngestResult"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            422: components["responses"]["EventBatchUnprocessable"];
            500: components["responses"]["InternalServerError"];
        };
    };
    confirmExposure: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExposureConfirmation"];
            };
        };
        responses: {
            /** @description Ya estaba registrada; nada cambió. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "decisionId": "dec_01JBQ2X8N4K3M7P9R2T5V8W9",
                     *       "status": "already-recorded"
                     *     }
                     */
                    "application/json": components["schemas"]["ExposureResult"];
                };
            };
            /** @description Exposición registrada. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExposureResult"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            422: components["responses"]["ExposureUnprocessable"];
            500: components["responses"]["InternalServerError"];
        };
    };
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
