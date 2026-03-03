async function build() {
	try {
		console.log("Building the project...");
		await Bun.build({
			entrypoints: ["./src/index.ts"],
			outdir: "./build",
		});
		console.log("Build completed successfully.");
	} catch (error) {
		console.error("Build failed:", error);
		process.exit(1);
	}
}

void build();
