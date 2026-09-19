import path from "node:path";
import { fileURLToPath } from "node:url";
import { Generator, getConfig } from "@tanstack/router-generator";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, ".."); // frontend root
const config = await getConfig(
  {
    target: "react",
    routesDirectory: "./src/routes",
    generatedRouteTree: "./src/routeTree.gen.ts",
    quoteStyle: "single",
    semicolons: false,
    disableTypes: false,
  },
  root,
);
const gen = new Generator({ config, root });
await gen.run();
console.log("GENERATED routeTree.gen.ts OK");
