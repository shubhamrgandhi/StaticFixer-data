// Entry file for integration testing purposes
import { Tests } from './integration-tests';
import * as QueryString from 'query-string';

export { Tests };

async function main(): Promise<void> {
  const params = QueryString.parse(window.location.search);
  const invalidTestNames: string[] = [];

  if (params.integration) {
    return;
  }

  // tslint:disable-next-line:no-any
  (window as any).results = Object.keys(params).map(async testName => {
	const param = params[testName];
	const input = typeof param === 'string' ? param : '';
	const test = (Tests as any)[testName];
	const raw = input ? JSON.parse(input) : [];
	const parameters = Array.isArray(raw) ? raw : [raw];
	return test(...parameters) ;
});

  if (invalidTestNames.length > 0) {
    console.warn(`${invalidTestNames.join(', ')} are no valid testnames`);
  }

  if (invalidTestNames.length > 0 || Object.keys(params).length === 0) {
    // tslint:disable-next-line:no-console
    console.info(`Available test names: ${Object.keys(Tests).join(', ')}`);
  }
}

main();
