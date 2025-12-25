import { createMachine, assign } from 'xstate';

export interface DeploymentContext {
  serviceName: string;
  workflowId: number;
  runId?: number;
  error?: string;
  retriesLeft: number;
}

export type DeploymentEvent =
  | { type: 'TRIGGER'; workflowId: number }
  | { type: 'RUN_STARTED'; runId: number }
  | { type: 'SUCCESS' }
  | { type: 'FAILURE'; error: string }
  | { type: 'HEALTH_OK' }
  | { type: 'HEALTH_FAIL' }
  | { type: 'RETRY' }
  | { type: 'CANCEL' };

export const createDeploymentMachine = (serviceName: string) =>
  createMachine({
    id: 'deployment',
    initial: 'idle',
    context: {
      serviceName,
      workflowId: 0,
      runId: undefined,
      error: undefined,
      retriesLeft: 3,
    } as DeploymentContext,
    states: {
      idle: {
        on: {
          TRIGGER: {
            target: 'triggering',
            actions: assign({
              workflowId: ({ event }) => event.workflowId,
              error: undefined,
            }),
          },
        },
      },
      triggering: {
        on: {
          RUN_STARTED: {
            target: 'deploying',
            actions: assign({
              runId: ({ event }) => event.runId,
            }),
          },
          FAILURE: {
            target: 'failed',
            actions: assign({
              error: ({ event }) => event.error,
            }),
          },
          CANCEL: 'idle',
        },
      },
      deploying: {
        on: {
          SUCCESS: 'checking',
          FAILURE: {
            target: 'failed',
            actions: assign({
              error: ({ event }) => event.error,
            }),
          },
          CANCEL: 'idle',
        },
      },
      checking: {
        on: {
          HEALTH_OK: 'success',
          HEALTH_FAIL: {
            target: 'failed',
            actions: assign({
              error: 'Health check failed after deployment',
            }),
          },
          RETRY: [
            {
              guard: ({ context }) => context.retriesLeft > 0,
              target: 'checking',
              actions: assign({
                retriesLeft: ({ context }) => context.retriesLeft - 1,
              }),
            },
            {
              target: 'failed',
              actions: assign({
                error: 'Max retries exceeded for health check',
              }),
            },
          ],
        },
      },
      success: {
        on: {
          TRIGGER: {
            target: 'triggering',
            actions: assign({
              workflowId: ({ event }) => event.workflowId,
              error: undefined,
              retriesLeft: 3,
            }),
          },
        },
      },
      failed: {
        on: {
          TRIGGER: {
            target: 'triggering',
            actions: assign({
              workflowId: ({ event }) => event.workflowId,
              error: undefined,
              retriesLeft: 3,
            }),
          },
        },
      },
    },
  });
