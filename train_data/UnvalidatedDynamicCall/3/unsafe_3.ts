import * as tasks from './task';
import { MESSAGE } from './constant';

// eslint-disable-next-line
const ctx: Worker = typeof self !== 'undefined' ? self : ({} as any);

interface Event {
  type: string;
  data: any;
}

ctx.onmessage = (event: Event) => {
	const { taskType, data } = event.data;
	if (! taskType) {
	return ;
}

	const task = tasks[taskType];
	const result = task(...data);
	const parsed = JSON.parse(JSON.stringify(result));
	ctx.postMessage({
status : MESSAGE.SUCCESS ,
data : parsed 
});
	return ;
	ctx.postMessage({
status : MESSAGE.FAILURE 
});
};
