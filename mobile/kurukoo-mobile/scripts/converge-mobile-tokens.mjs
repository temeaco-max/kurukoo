import { readFile, writeFile } from "node:fs/promises";
import { glob } from "glob";

const files = await glob(["app/**/*.{tsx,ts}", "components/**/*.{tsx,ts}", "lib/**/*.{tsx,ts}"], { cwd: "/home/ubuntu/kurukoo-mobile", absolute: true });
const replacements = new Map([
  ["#E6DED5", "KURUKOO_VISUAL_TOKENS.border"],
  ["#6D665F", "KURUKOO_VISUAL_TOKENS.muted"],
  ["#FFF8F1", "KURUKOO_VISUAL_TOKENS.surfaceSoft"],
]);
for (const path of files) {
  let source = await readFile(path, "utf8");
  let changed = false;
  for (const [from, to] of replacements) {
    if (source.includes(`\"${from}\"`)) {
      source = source.replaceAll(`\"${from}\"`, to);
      changed = true;
    }
  }
  if (!changed) continue;
  if (!source.includes('from "@/lib/visual-contract"')) {
    source = `import { KURUKOO_VISUAL_TOKENS } from "@/lib/visual-contract";\n${source}`;
  }
  await writeFile(path, source);
  console.log(path);
}
