import { create } from 'zustand';
import { WS_URL } from '../lib/api';
import type { Diagnosis, PipelineResult, Prediction, Residual, Risk, RUL } from '../types/contracts';

// Deliberately holds only REAL backend output (Prediction/Residual/
// Diagnosis/RUL/Risk, exactly as the pipeline produced them) - unlike the
// sihaimodel-main baseline's computePhysicsExpected()/computeSOH(), this
// store never recomputes a fake health score client-side.
interface EngineStoreState {
  connected: boolean;
  lastUpdatedAt: number | null;
  prediction: Prediction | null;
  residual: Residual | null;
  diagnosis: Diagnosis | null;
  rul: RUL | null;
  risk: Risk | null;
  history: PipelineResult[];
  connect: () => void;
  disconnect: () => void;
}

const HISTORY_LIMIT = 300;

let socket: WebSocket | null = null;

export const useEngineStore = create<EngineStoreState>((set, get) => ({
  connected: false,
  lastUpdatedAt: null,
  prediction: null,
  residual: null,
  diagnosis: null,
  rul: null,
  risk: null,
  history: [],

  connect: () => {
    if (socket) return;
    socket = new WebSocket(WS_URL);

    socket.onopen = () => set({ connected: true });
    socket.onclose = () => {
      set({ connected: false });
      socket = null;
    };
    socket.onerror = () => {
      set({ connected: false });
    };
    socket.onmessage = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as PipelineResult & { heartbeat?: boolean };
      if (payload.heartbeat) return;

      const history = [...get().history, payload].slice(-HISTORY_LIMIT);
      set({
        prediction: payload.prediction,
        residual: payload.residual,
        diagnosis: payload.diagnosis,
        rul: payload.rul,
        risk: payload.risk,
        lastUpdatedAt: Date.now(),
        history,
      });
    };
  },

  disconnect: () => {
    socket?.close();
    socket = null;
    set({ connected: false });
  },
}));
