#!/usr/bin/env node
import { execFileSync } from 'child_process';
import watcher from "@parcel/watcher";
import path from "node:path";
import { debounce } from "lodash-es";
import { loadEnv } from "ldenv";

const args = process.argv.slice(2);

function error(msg: string) {
  console.error(msg);
  process.exit(1);
}

let deploymentContext = "localhost";
let argToConsume;
let command: string | undefined;
let commandArgs: string[] | undefined;
const options: { [key: string]: string[] } = {};
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith("--")) {
    argToConsume = arg.substring(2);
  } else if (arg.startsWith("-")) {
    argToConsume = arg.substring(1);
  } else {
    if (argToConsume) {
      if (options[argToConsume]) {
        options[argToConsume].push(arg);
      } else {
        options[argToConsume] = [arg];
      }
      argToConsume = undefined;
    } else {
      command = arg;
      commandArgs = args.slice(i + 1);
      break;
    }
  }
}

if (!command) {
  error(`please specify a command`);
}
const commandToUse = command!;

loadEnv({ mode: deploymentContext });

async function _execute() {
  execFileSync(commandToUse, commandArgs, { stdio: ["inherit", "inherit", "inherit"] });
}


async function main() {
  const execute = debounce(_execute, 50);
  for (const p of options["w"]) {
    watcher.subscribe(path.join(process.cwd(), p), (err, events) => {
      console.log(`Files changed under ${p}`)
      execute();
    });
  }
  execute();
}
main();
