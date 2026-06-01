import { type VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  functions: {
    "src/app/api/tasks/route.ts": {
      maxDuration: 600,
      experimentalTriggers: [
        {
          type: "queue/v2beta",
          topic: "tasks",
        },
      ],
    },
    "src/app/api/[[...route]]/route.ts": {
      maxDuration: "max",
    },
    "src/app/api/webhooks/[platform]/route.ts": {
      maxDuration: 300,
    },
  },
};
