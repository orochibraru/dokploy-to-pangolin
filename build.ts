import Bun, { Glob } from "bun";

async function build() {
	try {
		console.log("Building the project...");
		await Bun.build({
			entrypoints: ["./src/index.ts"],
			outdir: "./build",
		});
		console.log(`Built the project successfully to ./build`);
		const glob = new Glob("*");
		const scan = glob.scan("./build");
		for await (const file of scan) {
			console.log(`- ${file}`);
		}
	} catch (error) {
		console.error("Build failed:", error);
		process.exit(1);
	}
}

void build();
