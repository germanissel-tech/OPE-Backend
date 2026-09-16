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
         * Ingest a batch of SDK events
         * @description Receives a batch of behavioural events from **one** session, with the merchant identified by
         *     the ingest credential. Validates against the allow-list (any undeclared field rejects the
         *     whole batch with `400`), deduplicates by `eventId` within the merchant (window: 24 hours or
         *     100,000 events per merchant, whichever comes first, in the in-memory profile) and returns
         *     the decision for the session. A rejected batch produces no decision.
         *
         *     Nothing outside the allow-list is stored or written to logs; the IP address is not
         *     persisted (01-arquitectura-mvp.md §10.2).
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
         * Confirm the exposure of an intervention
         * @description The SDK confirms that the intervention of a decision was rendered and visible. Only then
         *     does an exposure exist (`EXPOSED` state of the evidence chain, 01 §5); the decision alone
         *     does not imply it. The decision must exist for the credential's merchant and must have
         *     been an intervention. A repeated confirmation does not duplicate the record.
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
         * Service status
         * @description Returns the service status, the contract version it is running with and the timestamp of
         *     the response. Requires no authentication. Declares no parameters: any query parameter is
         *     rejected with `400`.
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
        /** @description Added to cart. */
        AddedToCart: {
            device: components["schemas"]["DeviceClass"];
            eventId: components["schemas"]["EventId"];
            /**
             * Format: date-time
             * @description Instant of the event according to the browser (RFC 3339). Accepted tolerance: up to 5 minutes in the future and 24 hours in the past relative to the backend clock; beyond that, `event-timestamp-out-of-range`.
             */
            occurredAt: string;
            page: components["schemas"]["PageContext"];
            /** @description Units added. */
            quantity: number;
            sessionId: components["schemas"]["SessionId"];
            /**
             * @description Discriminator of the event type. (enum property replaced by openapi-typescript)
             * @enum {string}
             */
            type: "added_to_cart";
            visitorId: components["schemas"]["VisitorId"];
        };
        /**
         * @description Semantic anchor point where an intervention is (or was) rendered. The SDK resolves it with the merchant's anchor map.
         * @enum {string}
         */
        Anchor: "size_selector" | "price" | "cta" | "policies";
        /** @description Scroll and dwell over a block of the product page. */
        BlockDwelled: {
            /**
             * @description Semantic block of the product page the visitor dwelled on.
             * @enum {string}
             */
            block: "description" | "size_guide" | "reviews" | "policies" | "price" | "gallery" | "cta";
            device: components["schemas"]["DeviceClass"];
            /** @description Milliseconds of dwell over the block. */
            dwellMs: number;
            eventId: components["schemas"]["EventId"];
            /**
             * Format: date-time
             * @description Instant of the event according to the browser (RFC 3339). Accepted tolerance: up to 5 minutes in the future and 24 hours in the past relative to the backend clock; beyond that, `event-timestamp-out-of-range`.
             */
            occurredAt: string;
            page: components["schemas"]["PageContext"];
            sessionId: components["schemas"]["SessionId"];
            /**
             * @description Discriminator of the event type. (enum property replaced by openapi-typescript)
             * @enum {string}
             */
            type: "block_dwelled";
            visitorId: components["schemas"]["VisitorId"];
        };
        /** @description Checkout progress. OPE observes the transition to infer and measure; it does not intervene there. */
        CheckoutAdvanced: {
            device: components["schemas"]["DeviceClass"];
            eventId: components["schemas"]["EventId"];
            /**
             * Format: date-time
             * @description Instant of the event according to the browser (RFC 3339). Accepted tolerance: up to 5 minutes in the future and 24 hours in the past relative to the backend clock; beyond that, `event-timestamp-out-of-range`.
             */
            occurredAt: string;
            page: components["schemas"]["PageContext"];
            sessionId: components["schemas"]["SessionId"];
            /**
             * @description Step reached.
             * @enum {string}
             */
            step: "cart" | "checkout_started" | "shipping" | "payment" | "review";
            /**
             * @description Discriminator of the event type. (enum property replaced by openapi-typescript)
             * @enum {string}
             */
            type: "checkout_advanced";
            visitorId: components["schemas"]["VisitorId"];
        };
        /** @description Hover or approach to the purchase call to action. */
        CtaApproached: {
            /**
             * @description How the CTA was approached.
             * @enum {string}
             */
            approach: "hover" | "near";
            device: components["schemas"]["DeviceClass"];
            eventId: components["schemas"]["EventId"];
            /**
             * Format: date-time
             * @description Instant of the event according to the browser (RFC 3339). Accepted tolerance: up to 5 minutes in the future and 24 hours in the past relative to the backend clock; beyond that, `event-timestamp-out-of-range`.
             */
            occurredAt: string;
            page: components["schemas"]["PageContext"];
            sessionId: components["schemas"]["SessionId"];
            /**
             * @description Discriminator of the event type. (enum property replaced by openapi-typescript)
             * @enum {string}
             */
            type: "cta_approached";
            visitorId: components["schemas"]["VisitorId"];
        };
        /**
         * @description OPE's decision for the session after processing the batch. It always exists: not intervening
         *     is a result with a reason, never an absence (constitution II). `reason` is a string from the
         *     catalogue `contracts/no-op-reasons.yaml`; the catalogue grows without an incompatible change
         *     (which is why it is not an enum).
         */
        Decision: {
            decisionId: components["schemas"]["DecisionId"];
            intervention?: components["schemas"]["Intervention"];
            /**
             * @description `NO_OP`: do not intervene. `INTERVENE` is reserved for the decision plane (PROPUESTO).
             * @enum {string}
             */
            outcome: "NO_OP" | "INTERVENE";
            /** @description Reason for the outcome, from the catalogue `contracts/no-op-reasons.yaml` (for example `decision-plane-unavailable`). */
            reason: string;
            sessionId: components["schemas"]["SessionId"];
        };
        /** @description Identifier of a decision issued by OPE. Generated by the backend and quoted by the SDK when confirming an exposure. */
        DecisionId: string;
        /**
         * @description Device class, for layout only. Never an identifying fingerprint (01 §10.2).
         * @enum {string}
         */
        DeviceClass: "desktop" | "mobile" | "tablet";
        /**
         * @description A behavioural event from the SDK. Closed allow-list (03-alcance-mvp.md §4.1): a type outside
         *     this union or an undeclared field rejects the whole batch (01 §10.3).
         *     The `mapping` is explicit so that the generated types carry the wire value; the server strips
         *     it before compiling the validators because Ajv does not support it (ADR-014).
         */
        Event: components["schemas"]["ProductViewed"] | components["schemas"]["ListingViewed"] | components["schemas"]["SizeSelectorInteracted"] | components["schemas"]["VariantSelected"] | components["schemas"]["PhotoInteracted"] | components["schemas"]["BlockDwelled"] | components["schemas"]["CtaApproached"] | components["schemas"]["ProductReturnedTo"] | components["schemas"]["AddedToCart"] | components["schemas"]["RemovedFromCart"] | components["schemas"]["CheckoutAdvanced"] | components["schemas"]["ExitSignaled"];
        /** @description Batch of events from **one** session. Every event must belong to the same visitor (`session-visitor-mismatch` otherwise). */
        EventBatch: {
            /** @description Events in the order the SDK captured them. Ordering comes from `occurredAt`, not from the position. */
            events: components["schemas"]["Event"][];
        };
        /** @description Unique identifier of the event, generated by the SDK. Deduplicates retries and replays within the merchant. */
        EventId: string;
        /** @description Result of one event of the batch. */
        EventResult: {
            eventId: components["schemas"]["EventId"];
            /**
             * @description `accepted`: it came in and was recorded. `duplicate`: it had already been received for this merchant (retry or replay); it is not recorded twice.
             * @enum {string}
             */
            status: "accepted" | "duplicate";
        };
        /** @description Exit signal. Exactly the four of 03 §4.1; adding one is a scope change. */
        ExitSignaled: {
            device: components["schemas"]["DeviceClass"];
            eventId: components["schemas"]["EventId"];
            /**
             * Format: date-time
             * @description Instant of the event according to the browser (RFC 3339). Accepted tolerance: up to 5 minutes in the future and 24 hours in the past relative to the backend clock; beyond that, `event-timestamp-out-of-range`.
             */
            occurredAt: string;
            page: components["schemas"]["PageContext"];
            sessionId: components["schemas"]["SessionId"];
            /**
             * @description Which of the four exit signals.
             * @enum {string}
             */
            signal: "inactivity" | "tab_hidden" | "back_navigation" | "exit_intent";
            /**
             * @description Discriminator of the event type. (enum property replaced by openapi-typescript)
             * @enum {string}
             */
            type: "exit_signaled";
            visitorId: components["schemas"]["VisitorId"];
        };
        /** @description Confirmation from the SDK that an intervention was rendered and visible. This is what constitutes an exposure (01 §3.1), not the decision. */
        ExposureConfirmation: {
            anchor: components["schemas"]["Anchor"];
            decisionId: components["schemas"]["DecisionId"];
            /**
             * Format: date-time
             * @description Instant at which the intervention was visible, according to the browser.
             */
            exposedAt: string;
            sessionId: components["schemas"]["SessionId"];
            visitorId: components["schemas"]["VisitorId"];
        };
        /** @description Result of recording the exposure. */
        ExposureResult: {
            decisionId: components["schemas"]["DecisionId"];
            /**
             * @description `recorded`: recorded as EXPOSED. `already-recorded`: it already was; the record did not change.
             * @enum {string}
             */
            status: "recorded" | "already-recorded";
        };
        /** @description Service status. */
        Health: {
            /** @description Semantic version of the OpenAPI contract the server loaded at startup. */
            contractVersion: string;
            /**
             * @description `ok` when the service can serve requests. `degraded` is reserved for when external dependencies exist whose outage does not prevent responding.
             * @enum {string}
             */
            status: "ok" | "degraded";
            /**
             * Format: date-time
             * @description UTC instant at which the response was produced (RFC 3339).
             */
            timestamp: string;
        };
        /** @description Response to an accepted batch. Carries the result per event and the decision for the session. */
        IngestResult: {
            /** @description Number of events that came in. */
            accepted: number;
            decision: components["schemas"]["Decision"];
            /** @description Number of events already received before. */
            duplicates: number;
            /** @description One result per event, in batch order. */
            results: components["schemas"]["EventResult"][];
        };
        /**
         * @description PROPUESTO — Placeholder for the intervention the decision plane will emit in later features.
         *     The SDK team validates this shape before 010; until then no decision carries it (`outcome`
         *     is always `NO_OP`).
         */
        Intervention: {
            anchor: components["schemas"]["Anchor"];
            /** @description Version of the curated message to render. The text is served by the message catalogue, not by this contract. */
            messageVersionId: string;
        };
        /** @description View of a listing or category. */
        ListingViewed: {
            device: components["schemas"]["DeviceClass"];
            eventId: components["schemas"]["EventId"];
            /**
             * Format: date-time
             * @description Instant of the event according to the browser (RFC 3339). Accepted tolerance: up to 5 minutes in the future and 24 hours in the past relative to the backend clock; beyond that, `event-timestamp-out-of-range`.
             */
            occurredAt: string;
            page: components["schemas"]["PageContext"];
            sessionId: components["schemas"]["SessionId"];
            /**
             * @description Discriminator of the event type. (enum property replaced by openapi-typescript)
             * @enum {string}
             */
            type: "listing_viewed";
            visitorId: components["schemas"]["VisitorId"];
        };
        /** @description Monetary amount. The amount travels as a decimal string so no precision is lost (ADR-014). */
        Money: {
            /** @description Amount with up to two decimals, dot as separator, no sign and no thousands separators. */
            amount: string;
            /** @description Currency in ISO 4217. */
            currency: string;
        };
        /**
         * @description What the SDK could resolve about the page where the event happened (01-arquitectura-mvp.md
         *     §3.1.1, `PageContext`). Everything but `pageType` is optional: the SDK reports what it resolved
         *     and the backend fails closed on an incomplete context (`NO_OP` with reason `page-context-incomplete`).
         *     Allow-list: no other page data comes in (01 §10.2).
         */
        PageContext: {
            /**
             * @description Availability of the variant as the page shows it. A guard, not a claim (01 §4.3).
             * @enum {string}
             */
            availability?: "in_stock" | "out_of_stock" | "unknown";
            /**
             * @description Page type according to the SDK's platform adapter.
             * @enum {string}
             */
            pageType: "product" | "listing" | "cart" | "checkout" | "other";
            price?: components["schemas"]["Money"];
            /** @description Product identifier on the merchant's platform, as the page exposes it. */
            productId?: string;
            /** @description Identifier of the selected variant (size + colour), if any. */
            variantId?: string;
        };
        /** @description Zoom or navigation between product photos. */
        PhotoInteracted: {
            device: components["schemas"]["DeviceClass"];
            eventId: components["schemas"]["EventId"];
            /**
             * @description What the visitor did with the photos.
             * @enum {string}
             */
            interaction: "zoom" | "navigate";
            /**
             * Format: date-time
             * @description Instant of the event according to the browser (RFC 3339). Accepted tolerance: up to 5 minutes in the future and 24 hours in the past relative to the backend clock; beyond that, `event-timestamp-out-of-range`.
             */
            occurredAt: string;
            page: components["schemas"]["PageContext"];
            sessionId: components["schemas"]["SessionId"];
            /**
             * @description Discriminator of the event type. (enum property replaced by openapi-typescript)
             * @enum {string}
             */
            type: "photo_interacted";
            visitorId: components["schemas"]["VisitorId"];
        };
        /** @description Error according to RFC 9457 (Problem Details for HTTP APIs). Every 4xx/5xx response of the API uses this schema with the `application/problem+json` content type. The values of `type` belong to the catalogue `contracts/problem-types.yaml` (URN `urn:ope:problem:<slug>`). */
        ProblemDetails: {
            /** @description Human-readable explanation of this occurrence. Never includes internal details. */
            detail?: string;
            /** @description Individual contract violations. Present only in `400` and `422`. */
            errors?: {
                /** @description Description of the violation. */
                message: string;
                /** @description JSON Pointer relative to the request (`/query/foo`, `/body/kind`, `/headers/x`). */
                pointer: string;
            }[];
            /** @description URI reference of the occurrence; usually the request path. */
            instance?: string;
            /** @description HTTP status code of the response, repeated in the body. */
            status: number;
            /** @description Short, fixed summary for the problem type. */
            title: string;
            /**
             * Format: uri
             * @description Stable identifier of the problem type, from OPE's catalogue.
             */
            type: string;
        };
        /** @description Return to a product seen earlier in the session (A → B → A comparison). Observed and recorded; it has no messages of its own in the MVP. */
        ProductReturnedTo: {
            device: components["schemas"]["DeviceClass"];
            eventId: components["schemas"]["EventId"];
            /**
             * Format: date-time
             * @description Instant of the event according to the browser (RFC 3339). Accepted tolerance: up to 5 minutes in the future and 24 hours in the past relative to the backend clock; beyond that, `event-timestamp-out-of-range`.
             */
            occurredAt: string;
            page: components["schemas"]["PageContext"];
            /** @description Product the visitor came back from. */
            previousProductId: string;
            sessionId: components["schemas"]["SessionId"];
            /**
             * @description Discriminator of the event type. (enum property replaced by openapi-typescript)
             * @enum {string}
             */
            type: "product_returned_to";
            visitorId: components["schemas"]["VisitorId"];
        };
        /** @description View of a product page. */
        ProductViewed: {
            device: components["schemas"]["DeviceClass"];
            eventId: components["schemas"]["EventId"];
            /**
             * Format: date-time
             * @description Instant of the event according to the browser (RFC 3339). Accepted tolerance: up to 5 minutes in the future and 24 hours in the past relative to the backend clock; beyond that, `event-timestamp-out-of-range`.
             */
            occurredAt: string;
            page: components["schemas"]["PageContext"];
            sessionId: components["schemas"]["SessionId"];
            /**
             * @description Discriminator of the event type. (enum property replaced by openapi-typescript)
             * @enum {string}
             */
            type: "product_viewed";
            visitorId: components["schemas"]["VisitorId"];
        };
        /** @description Removal from the cart. The return to the product page arrives as a later `product_viewed`; together they are the barrier amplifier (03 §4.2). */
        RemovedFromCart: {
            device: components["schemas"]["DeviceClass"];
            eventId: components["schemas"]["EventId"];
            /**
             * Format: date-time
             * @description Instant of the event according to the browser (RFC 3339). Accepted tolerance: up to 5 minutes in the future and 24 hours in the past relative to the backend clock; beyond that, `event-timestamp-out-of-range`.
             */
            occurredAt: string;
            page: components["schemas"]["PageContext"];
            sessionId: components["schemas"]["SessionId"];
            /**
             * @description Discriminator of the event type. (enum property replaced by openapi-typescript)
             * @enum {string}
             */
            type: "removed_from_cart";
            visitorId: components["schemas"]["VisitorId"];
        };
        /** @description Identifier of the visit, generated by the SDK. Groups the behavioural sequence; it expires. */
        SessionId: string;
        /** @description Interaction with the size selector. */
        SizeSelectorInteracted: {
            device: components["schemas"]["DeviceClass"];
            eventId: components["schemas"]["EventId"];
            /**
             * Format: date-time
             * @description Instant of the event according to the browser (RFC 3339). Accepted tolerance: up to 5 minutes in the future and 24 hours in the past relative to the backend clock; beyond that, `event-timestamp-out-of-range`.
             */
            occurredAt: string;
            page: components["schemas"]["PageContext"];
            sessionId: components["schemas"]["SessionId"];
            /** @description Label of the size interacted with, as the store shows it. */
            size: string;
            /**
             * @description Discriminator of the event type. (enum property replaced by openapi-typescript)
             * @enum {string}
             */
            type: "size_selector_interacted";
            visitorId: components["schemas"]["VisitorId"];
        };
        /** @description Colour or variant selection. */
        VariantSelected: {
            device: components["schemas"]["DeviceClass"];
            eventId: components["schemas"]["EventId"];
            /**
             * Format: date-time
             * @description Instant of the event according to the browser (RFC 3339). Accepted tolerance: up to 5 minutes in the future and 24 hours in the past relative to the backend clock; beyond that, `event-timestamp-out-of-range`.
             */
            occurredAt: string;
            page: components["schemas"]["PageContext"];
            /** @description Variant chosen in the selector. */
            selectedVariantId: string;
            sessionId: components["schemas"]["SessionId"];
            /**
             * @description Discriminator of the event type. (enum property replaced by openapi-typescript)
             * @enum {string}
             */
            type: "variant_selected";
            visitorId: components["schemas"]["VisitorId"];
        };
        /** @description Pseudonymous, persistent identifier of the browser, generated by the SDK. Gives stability to the experimental assignment. Does not identify a person. */
        VisitorId: string;
    };
    responses: {
        /** @description Unknown, missing or wrongly typed parameter, header or field. `errors` lists each violation; the handler was not invoked. */
        BadRequest: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:ope:problem:validation-failed",
                 *       "title": "The request does not satisfy the contract",
                 *       "status": 400,
                 *       "instance": "/v1/health"
                 *     }
                 */
                "application/problem+json": components["schemas"]["ProblemDetails"];
            };
        };
        /** @description The batch satisfies the schema but violates an ingestion invariant. */
        EventBatchUnprocessable: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["ProblemDetails"];
            };
        };
        /** @description The confirmation satisfies the schema but cannot be recorded. */
        ExposureUnprocessable: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["ProblemDetails"];
            };
        };
        /** @description The credential is valid but the browser's `Origin` is not among the merchant's registered origins. */
        Forbidden: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:ope:problem:origin-not-allowed",
                 *       "title": "Origin not registered for the merchant",
                 *       "status": 403,
                 *       "instance": "/v1/events"
                 *     }
                 */
                "application/problem+json": components["schemas"]["ProblemDetails"];
            };
        };
        /** @description Internal failure, unhandled exception or a handler response that does not satisfy the contract. Exposes no internal details. */
        InternalServerError: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:ope:problem:internal-error",
                 *       "title": "Internal error",
                 *       "status": 500,
                 *       "instance": "/v1/health"
                 *     }
                 */
                "application/problem+json": components["schemas"]["ProblemDetails"];
            };
        };
        /** @description The operation requires a credential and no valid one was presented. */
        Unauthorized: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:ope:problem:unauthorized",
                 *       "title": "Credential missing or invalid",
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
            /** @description Batch accepted. Duplicates are reported per event; the decision is for the session. */
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
            /** @description Already recorded; nothing changed. */
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
            /** @description Exposure recorded. */
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
            /** @description The service is operational. */
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
