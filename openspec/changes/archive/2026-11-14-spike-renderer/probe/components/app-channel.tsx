import { register } from "../port/index.ts";
import { AppChannel } from "./_app-channel.tsx";

// `App` sets zod's `jitless` itself, in its constructor.
register("AppChannel", AppChannel);
