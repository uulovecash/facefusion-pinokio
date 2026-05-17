import { Agent } from "@cursor/sdk";

const agent = await Agent.create({
  apiKey: process.env.CURSOR_API_KEY,
  model: { id: "composer-2" },
  local: { cwd: process.cwd() },
});

try {
  const run = await agent.send("Summarize what this repository does");

  for await (const event of run.stream()) {
    if (event.type === "assistant") {
      for (const block of event.message.content) {
        if (block.type === "text") process.stdout.write(block.text);
      }
    }
  }

  const result = await run.wait();

  if (result.status === "error") {
    console.error(`\nRun failed: ${run.id}`);
    process.exit(2);
  }

  console.log(`\n[Done] Run ${run.id} finished with status: ${result.status}`);
} finally {
  await agent[Symbol.asyncDispose]();
}
