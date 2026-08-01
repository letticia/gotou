import { describe, expect, it } from "vitest";
import { createUpdateWatcher } from "./swUpdate";

class FakeWorker extends EventTarget {
  state: string;
  constructor(state: string) {
    super();
    this.state = state;
  }
  setState(state: string) {
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }
}

class FakeRegistration extends EventTarget {
  waiting: FakeWorker | null;
  installing: FakeWorker | null = null;
  constructor(waiting: FakeWorker | null = null) {
    super();
    this.waiting = waiting;
  }
  triggerUpdateFound(worker: FakeWorker) {
    this.installing = worker;
    this.dispatchEvent(new Event("updatefound"));
  }
}

function watcherFor(registration: FakeRegistration, hasController: () => boolean) {
  return createUpdateWatcher(
    registration as unknown as ServiceWorkerRegistration,
    hasController,
  );
}

describe("createUpdateWatcher", () => {
  it("returns false when there is no waiting worker at creation time", () => {
    const watcher = watcherFor(new FakeRegistration(null), () => true);
    expect(watcher.isUpdateAvailable()).toBe(false);
  });

  it("returns true when a waiting worker already exists and a controller is active", () => {
    const registration = new FakeRegistration(new FakeWorker("installed"));
    const watcher = watcherFor(registration, () => true);
    expect(watcher.isUpdateAvailable()).toBe(true);
  });

  it("becomes true once a newly found worker finishes installing, when a controller already exists (genuine update)", () => {
    const registration = new FakeRegistration(null);
    const watcher = watcherFor(registration, () => true);
    expect(watcher.isUpdateAvailable()).toBe(false);

    let notified = 0;
    watcher.subscribe(() => notified++);

    const newWorker = new FakeWorker("installing");
    registration.triggerUpdateFound(newWorker);
    newWorker.setState("installed");

    expect(watcher.isUpdateAvailable()).toBe(true);
    expect(notified).toBe(1);
  });

  it("stays false when a worker installs but there is no controller yet (first-ever install, not an update)", () => {
    const registration = new FakeRegistration(null);
    const watcher = watcherFor(registration, () => false);

    const newWorker = new FakeWorker("installing");
    registration.triggerUpdateFound(newWorker);
    newWorker.setState("installed");

    expect(watcher.isUpdateAvailable()).toBe(false);
  });

  it("stops notifying a listener after it unsubscribes", () => {
    const registration = new FakeRegistration(null);
    const watcher = watcherFor(registration, () => true);

    let notified = 0;
    const unsubscribe = watcher.subscribe(() => notified++);
    unsubscribe();

    const newWorker = new FakeWorker("installing");
    registration.triggerUpdateFound(newWorker);
    newWorker.setState("installed");

    expect(notified).toBe(0);
  });

  it("applyUpdate posts SKIP_WAITING to the waiting worker", () => {
    const waiting = new FakeWorker("installed") as unknown as ServiceWorker & {
      postMessage: (msg: unknown) => void;
      posted: unknown[];
    };
    const posted: unknown[] = [];
    waiting.postMessage = (msg: unknown) => posted.push(msg);
    const registration = new FakeRegistration(waiting as unknown as FakeWorker);
    const watcher = watcherFor(registration, () => true);

    watcher.applyUpdate();

    expect(posted).toEqual(["SKIP_WAITING"]);
  });
});
