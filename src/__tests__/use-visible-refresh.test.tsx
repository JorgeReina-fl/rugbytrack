import { renderHook } from "@testing-library/react";
import { useVisibleRefresh } from "@/hooks/useVisibleRefresh";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useVisibleRefresh", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    refresh.mockClear();
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  });
  afterEach(() => jest.useRealTimers());

  test("refresca cada 15 s con la pestaña visible", () => {
    renderHook(() => useVisibleRefresh());
    jest.advanceTimersByTime(14_999);
    expect(refresh).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(30_000);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  test("no refresca con la pestaña oculta y reanuda (con refresh inmediato) al volver", () => {
    renderHook(() => useVisibleRefresh());
    setVisibility("hidden");
    jest.advanceTimersByTime(60_000);
    expect(refresh).not.toHaveBeenCalled();
    setVisibility("visible");
    expect(refresh).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(15_000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  test("limpia el intervalo al desmontar", () => {
    const { unmount } = renderHook(() => useVisibleRefresh());
    unmount();
    jest.advanceTimersByTime(60_000);
    expect(refresh).not.toHaveBeenCalled();
  });
});
