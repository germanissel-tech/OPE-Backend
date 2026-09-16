// Shape fixture: a controller instantiating an npm client itself (infrastructure outside composition).
import Fastify from "fastify";
import { Redis } from "ioredis";

export function bad(): unknown {
  const app = Fastify();
  const cache = new Redis();
  return { app, cache };
}
