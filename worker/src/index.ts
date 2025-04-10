import { DurableObject } from "cloudflare:workers";

export class LlmAgent extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	async sayHello(name: string): Promise<string> {
		return `Hello, ${name}!`;
	}

	async fetch(request: Request): Promise<Response> {
		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);
		this.ctx.acceptWebSocket(server);
		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
		ws.send(
			`[Durable Object] message: ${message}, connections: ${this.ctx.getWebSockets().length}`,
		);
	}

	async webSocketClose(
		ws: WebSocket,
		code: number,
		reason: string,
		wasClean: boolean,
	) {
		ws.close(code, "Durable Object is closing WebSocket");
	}
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		if (request.method === "GET" && request.url.endsWith("/websocket")) {
			// Expect to receive a WebSocket Upgrade request.
			// If there is one, accept the request and return a WebSocket Response.
			const upgradeHeader = request.headers.get("Upgrade");
			if (!upgradeHeader || upgradeHeader !== "websocket") {
				return new Response(null, {
					status: 426,
					statusText: "Durable Object expected Upgrade: websocket",
					headers: {
						"Content-Type": "text/plain",
					},
				});
			}

			// This example will refer to a single Durable Object instance, since the name "foo" is
			// hardcoded
			let id = env.LLM_AGENT_DURABLE_OBJECT.idFromName("foo");
			let stub = env.LLM_AGENT_DURABLE_OBJECT.get(id);

			// The Durable Object's fetch handler will accept the server side connection and return
			// the client
			return stub.fetch(request);
		}

		const id: DurableObjectId = env.LLM_AGENT_DURABLE_OBJECT.idFromName("foo");
		const stub = env.LLM_AGENT_DURABLE_OBJECT.get(id);
		const greeting = await stub.sayHello("world");
		return new Response(greeting);
	},
} satisfies ExportedHandler<Env>;
