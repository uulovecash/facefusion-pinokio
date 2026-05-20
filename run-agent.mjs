#!/usr/bin/env node
import { Agent, CursorAgentError } from "@cursor/sdk";
import { parseArgs } from "node:util";
import readline from "node:readline";

const { values, positionals } = parseArgs({
  options: {
    model: { type: "string", short: "m", default: "composer-2" },
    cwd: { type: "string", short: "C", default: process.cwd() },
    output: { type: "string", short: "o" },
    stream: { type: "boolean", default: true },
    help: { type: "boolean", short: "h", default: false },
  },
  allowPositionals: true,
});

if (values.help || positionals.length === 0) {
  console.log(`Usage: node run-agent.mjs [options] <prompt>...

Options:
  -m, --model <id>   Model ID (default: composer-2)
  -C, --cwd <path>   Working directory (default: cwd)
  -o, --output <f>   Write final result to file
  --no-stream        Disable streaming output

Examples:
  node run-agent.mjs "Summarize this repo"
  node run-agent.mjs -m auto "Find bugs in src"
  node run-agent.mjs -o result.txt "Review the last commit"
`);
  process.exit(0);
}

const prompt = positionals.join(" ");
const apiKey = process.env.CURSOR_API_KEY;

if (!apiKey) {
  console.error("Error: CURSOR_API_KEY environment variable is not set.");
  console.error("  export CURSOR_API_KEY='cursor_...'");
  process.exit(1);
}

console.log(`[Cursor Agent] model=${values.model} cwd=${values.cwd}`);
console.log(`[Prompt] ${prompt}\n`);
console.log("--- output start ---\n");

const agent = await Agent.create({
  apiKey,
  model: { id: values.model },
  local: { cwd: values.cwd },
});

try {
  const run = await agent.send(prompt);

  // Stream events
  if (values.stream) {
    const toolEvents = new Set(["tool_call", "tool_output", "working"]);

    for await (const event of run.stream()) {
      if (event.type === "assistant") {
        for (const block of event.message.content) {
          if (block.type === "text") {
            process.stdout.write(block.text);
          }
        }
      } else if (toolEvents.has(event.type)) {
        if (event.type === "tool_call") {
          process.stdout.write(`\n[tool] ${event.name}(${JSON.stringify(event.input)})\n`);
        } else if (event.type === "tool_output") {
          process.stdout.write(`[tool result] ${event.content}\n`);
        }
      } else if (event.type === "status") {
        process.stdout.write(`[status] ${event.status}\n`);
      }
    }
  } else {
    await run.wait();
  }

  const result = await run.wait();

  if (result.status === "error") {
    console.error(`\nRun failed (${run.id}). Check the Cursor dashboard for details.`);
    process.exit(2);
  }

  console.log("\n--- output end ---");

  // Save result to file if requested
  if (values.output) {
    const { default: fs } = await import("node:fs/promises");
    const text = typeof result.result === "string"
      ? result.result
      : JSON.stringify(result.result, null, 2);
    await fs.writeFile(values.output, text, "utf-8");
    console.log(`\n[Done] Run ${run.id} finished. Result saved to ${values.output}`);
  } else {
    console.log(`\n[Done] Run ${run.id} finished with status: ${result.status}`);
  }
} catch (err) {
  if (err instanceof CursorAgentError) {
    console.error(`\nStartup failed: ${err.message}`);
    console.error(`Retryable: ${err.isRetryable}`);
    process.exit(1);
  }
  throw err;
} finally {
  await agent[Symbol.asyncDispose]();
}
