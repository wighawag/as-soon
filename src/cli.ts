#!/usr/bin/env node
import {execFileSync} from 'child_process';
import watcher, {AsyncSubscription} from '@parcel/watcher';
import path from 'node:path';
import fs from 'node:fs';
import {debounce} from 'lodash';
import {loadEnv} from 'ldenv';

const args = process.argv.slice(2);

function error(msg: string) {
	console.error(msg);
	process.exit(1);
}

let deploymentContext = 'localhost';
let argToConsume;
let command: string | undefined;
let commandArgs: string[] | undefined;
const options: {[key: string]: string[]} = {};
for (let i = 0; i < args.length; i++) {
	const arg = args[i];
	if (arg.startsWith('--')) {
		argToConsume = arg.substring(2);
	} else if (arg.startsWith('-')) {
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

console.log(`"${commandToUse}"`);

loadEnv({mode: deploymentContext});

async function _execute() {
	try {
		execFileSync(commandToUse, commandArgs, {stdio: ['inherit', 'inherit', 'inherit']});
	} catch {}
}

// let counter = 0;
async function subscribe_target(absolute_path: string, execute: () => void) {
	// const c = ++counter;
	const p = path.relative(process.cwd(), absolute_path);
	const subscription = await watcher.subscribe(absolute_path, (err, events) => {
		// console.log(`Files changed under ${p} (${c})`);
		console.log(`Files changed under ${p}`);
		for (const event of events) {
			if (event.type === 'delete' && event.path === absolute_path) {
				subscription.unsubscribe();
				listen(absolute_path, execute);
				return;
			}
		}
		execute();
	});
}

async function listen(absolute_path: string, execute: () => void) {
	if (fs.existsSync(absolute_path)) {
		subscribe_target(absolute_path, execute);
	} else {
		// console.log(`${absolute_path} do not exist yet, listening on parent`)
		let tmp_subscription: AsyncSubscription | undefined = await watcher.subscribe(
			path.dirname(absolute_path),
			(err, events) => {
				for (const event of events) {
					if (event.type === 'create' && path.normalize(event.path) === absolute_path) {
						// console.log(`${absolute_path} just got created, listening for it...`);
						tmp_subscription?.unsubscribe();
						tmp_subscription = undefined;
						// wrap in a timeout to ensure @parcel/watcher hook on the correct inode?
						setTimeout((v) => {
							subscribe_target(absolute_path, execute);
						}, 500);
					}
				}
			}
		);
	}
}

async function main() {
	const execute = debounce(_execute, 50);
	if (options['w']) {
		console.log(`listening on: ${options['w'].join(', ')}`);
		for (const p of options['w']) {
			const absolute_path = path.normalize(path.join(process.cwd(), p));
			listen(absolute_path, execute);
		}
	} else {
		console.log(`listening on current folder`);
		const absolute_path = path.normalize(process.cwd());
		listen(absolute_path, execute);
	}

	execute();
}
main();
