import { saveLatestVersion } from "./saveLatestVersion";

test("persists an edit made while the first save is awaiting invalidation", async () => {
  let releaseFirst!: () => void;
  const firstInvalidation = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let version = 1;
  let draft = "first";
  const persisted: string[] = [];

  const pending = saveLatestVersion(
    () => ({ version, draft }),
    async (value) => {
      persisted.push(value);
      if (value === "first") await firstInvalidation;
    },
  );

  expect(persisted).toEqual(["first"]);
  version = 2;
  draft = "second";
  releaseFirst();

  await pending;
  expect(persisted).toEqual(["first", "second"]);
});

test("persists the newest draft after an older invalidation rejects", async () => {
  let rejectFirst!: (reason: Error) => void;
  const firstInvalidation = new Promise<void>((_resolve, reject) => {
    rejectFirst = reject;
  });
  let version = 1;
  let draft = "first";
  const persisted: string[] = [];

  const pending = saveLatestVersion(
    () => ({ version, draft }),
    async (value) => {
      persisted.push(value);
      if (value === "first") await firstInvalidation;
    },
  );

  version = 2;
  draft = "second";
  rejectFirst(new Error("revalidation failed"));

  await pending;
  expect(persisted).toEqual(["first", "second"]);
});
