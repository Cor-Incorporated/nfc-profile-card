import { parseDesignSave } from "./parseDesignSave";

test("keeps profile content and an explicit empty contact field", () => {
  const result = parseDesignSave({
    revision: "1:000000001",
    components: [
      {
        id: "profile-1",
        type: "profile",
        order: 0,
        content: { name: "Test", email: "", isInitialPlaceholder: false },
      },
    ],
    background: { type: "solid", color: "#ffffff" },
  });
  expect(result?.components[0].content).toMatchObject({
    name: "Test",
    email: "",
    isInitialPlaceholder: false,
  });
});

test("rejects oversize, duplicate, and mismatched component payloads", () => {
  const base = { revision: null, background: null };
  const item = {
    id: "one",
    type: "text",
    order: 0,
    content: { text: "Hello" },
  };
  expect(parseDesignSave({ ...base, components: [item, item] })).toBeNull();
  expect(
    parseDesignSave({
      ...base,
      components: [{ ...item, content: { url: "https://example.test" } }],
    }),
  ).toBeNull();
  expect(
    parseDesignSave({ ...base, components: Array(101).fill(item) }),
  ).toBeNull();
  expect(
    parseDesignSave({
      ...base,
      components: [],
      background: { type: "image", url: "javascript:alert(1)", opacity: 1 },
    }),
  ).toBeNull();
});
