// Fixture de tests/typecheck: accede a una propiedad inexistente (TS2339/TS2551); ejecuta igual.
import { walkFiles } from "../../../scripts/governance-lib.mjs";

const files = walkFiles(".", [".nada"]);
console.log(files.lenght);
