import * as ws from "ws";
import {
  createServer as createHttpServer,
  IncomingMessage,
  ServerResponse,
} from "http";

export enum HttpMethod {
  Get = "GET",
  Post = "POST",
  Put = "PUT",
  Delete = "DELETE",
}

export interface Request extends IncomingMessage {}
export interface Response extends ServerResponse {}
export interface RequestListener {
  (req: Request, res: Response): void;
}

export enum MessageType {
  Subscribe = "subscribe",
  Broadcast = "broadcast",
  Unsubscribe = "unsubscribe",
}

export type MessageEvent<
  Type extends MessageType,
  Data
> = Type extends MessageType.Subscribe
  ? {
      route: string;
      payload: { type: Type };
    }
  : { route: string; payload: { type: MessageType.Broadcast; data: Data } };

export interface Error {
  message: string;
}

export function error(message: string): Error;
export function error(type: string, message: string): Error;
export function error(param0: string, param1?: string): Error {
  if (param1 !== undefined) return { message: `[${param0}]: ${param1}` };

  return { message: param0 };
}

function getRoute(path: string) {
  const routeParts = path.substring(1).split("/");
  if (routeParts.length === 0) throw Error("not a correct route");
  return routeParts as [string];
}

// TODO: Refactor queryHandler
function queryHandler<Context, Queries extends Schema<Context>["queries"]>(
  req: Request,
  res: Response,
  queries: Queries,
  context: Context
) {
	const url = new URL("http://localhost" + req.url);
	const args = Object.fromEntries(url.searchParams);
	const [route] = getRoute(url.pathname);
	const routeFn = queries?.[route];
	const result = routeFn(args, context);
	res.writeHead(200, {
"Content-Type" : "application/json" 
});
	res.write(JSON.stringify(result));
	res.end();
	return ;
	res.writeHead(404, {
"Content-Type" : "application/json" 
});
	res.end(JSON.stringify({
message : "Doesn't exist" 
}));
}

// TODO: Refactor mutateHandler
function mutateHandler<Context, Queries extends Schema<Context>["mutations"]>(
  req: Request,
  res: Response,
  mutations: Queries,
  context: Context
) {
  // TODO: This is for testing purposes only
  const url = new URL("http://localhost" + req.url);

  let data = "";

  req.on("data", (chunk) => {
    data += chunk;
  });

  req.on("end", () => {
    const [route] = getRoute(url.pathname);

    if (mutations && route in mutations) {
      const routeFn = mutations?.[route];
      const result = routeFn(JSON.parse(data), context);

      // Implement messagepack
      res.writeHead(200, { "Content-Type": "application/json" });
      res.write(JSON.stringify(result));
      res.end();
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Doesn't exist" }));
  });
}

export interface Resolver<Context, Input, Output> {
  (args: Input, context: Context): Output;
}

export interface Resolvers<Context = any, Input = any, Output = any> {
  [key: string]: Resolver<Context, Input, Output>;
}

export interface Subscription<Context, Output> {
  (send: (data: Output) => void, context: Context): void;
}

export interface Subscriptions<Context = any, Output = any> {
  [key: string]: Subscription<Context, Output>;
}

export interface Schema<
  TContext extends Record<string, any>,
  Queries extends Resolvers<TContext> = Resolvers<TContext>,
  Mutations extends Resolvers<TContext> = Resolvers<TContext>,
  TSubscriptions extends Subscriptions<TContext> = Subscriptions<TContext>
> {
  queries?: Queries;
  mutations?: Mutations;
  subscriptions?: TSubscriptions;
}

export function createServer<
  TContext extends Record<string, any>,
  TSchema extends Schema<TContext>
>(schema: TSchema & { context: TContext }) {
  const { queries, mutations, subscriptions, context } = schema;

  const root: RequestListener = (req, res) => {
    // TODO: Handle case where url is missing from the request
    if (req.url === undefined) return;

    // TODO: Handle root call
    if (req.url === "/") return;

    if (req.method === HttpMethod.Get)
      return queryHandler(req, res, queries, context);

    if (
      [HttpMethod.Post, HttpMethod.Put, HttpMethod.Delete].includes(
        req.method as HttpMethod
      )
    ) {
      return mutateHandler(req, res, mutations, context);
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Doesn't exist" }));
  };

  const router = createHttpServer(root);

  // Websocket connection will not be made if no subscriptions are defined
  // in the server schema.
  if (Object.keys(subscriptions ?? {}).length > 0) {
    const wss = new ws.WebSocketServer({
      noServer: true,
      path: "/websocket",
    });

    router.on("upgrade", (request, socket, head) => {
      wss.handleUpgrade(request, socket, head, (websocket) => {
        wss.emit("connection", websocket, request);
      });
    });

    const subscriptionHandler = (ws: ws) => {
      ws.on("message", (message) => {
        const { route, payload } = JSON.parse(message.toString());
        switch (payload.type) {
          case "subscription":
            // TODO: Handle duplication
            subscriptions?.[route](
              (value) =>
                ws.send(
                  JSON.stringify({
                    route,
                    payload: { type: "broadcast", data: value },
                  })
                ),
              context
            );
            break;
          case "broadcast":
            // TODO: Might remove later
            wss.clients.forEach((client) => {
              if (client !== ws && client.readyState === ws.OPEN) {
                client.send(message);
              }
            });
            break;
        }
      });
    };

    wss.on("connection", subscriptionHandler);
  }

  return Object.assign(router, schema);
}
