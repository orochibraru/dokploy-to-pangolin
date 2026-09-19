#!/usr/bin/env bun
import { validateConfig } from "./config";
import { reconcileDuplicates } from "./lib/dedupe";

validateConfig();

const apply = process.argv.includes("--apply");
const rename = !process.argv.includes("--no-rename");

if (!apply) {
	console.log("Dry run - re-run with --apply to delete the duplicates.\n");
}

const result = await reconcileDuplicates({ apply, rename });

if (!result) {
	process.exit(1);
}

console.log(
	`\nScanned ${result.scanned} resources, ${result.groups.length} duplicated host name(s), ${result.groups.reduce((n, g) => n + g.duplicates.length, 0)} duplicate resource(s).`,
);

if (apply) {
	console.log(
		`Deleted ${result.deleted.length}, renamed ${result.renamed.length}, failed ${result.failed.length}.`,
	);
} else if (result.renamed.length > 0) {
	console.log(`${result.renamed.length} name(s) would be tidied up.`);
}

process.exit(result.failed.length > 0 ? 1 : 0);
