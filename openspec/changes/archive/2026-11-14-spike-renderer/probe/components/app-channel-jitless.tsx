import "./_zod-jitless.ts";
import { register } from "../port/index.ts";
import { AppChannel } from "./_app-channel.tsx";

// The measured change: zod's `jitless` set when the chunk loads, before ext-apps builds schemas.
register("AppChannelJitless", AppChannel);
