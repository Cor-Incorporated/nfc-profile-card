import { resolvePublicProfilePresentation } from "./publicProfilePresentation";

const rootProfile = {
  name: "Old Root Name",
  bio: "Old root biography",
  company: "Old Company",
  position: "Old Position",
  photoURL: "https://example.invalid/old.png",
};

test("edited card wins over stale root fields, including cleared fields", () => {
  const result = resolvePublicProfilePresentation(rootProfile, {
    components: [
      {
        type: "profile",
        order: 1,
        content: {
          firstName: "New",
          lastName: "Person",
          company: "New Company",
          bio: "",
          photoURL: "",
        },
      },
    ],
  });

  expect(result).toEqual({
    name: "Person New",
    bio: "",
    company: "New Company",
    position: "",
    photoURL: "",
  });
});

test("the first rendered profile card supplies the public presentation", () => {
  const result = resolvePublicProfilePresentation(rootProfile, {
    components: [
      {
        type: "profile",
        order: 9,
        content: {
          name: "Later Card",
          photoURL: "https://example.invalid/later.png",
        },
      },
      { type: "text", order: 0, content: { text: "Introduction" } },
      {
        type: "profile",
        order: 2,
        content: {
          name: "First Card",
          photoURL: "https://example.invalid/first.png",
        },
      },
    ],
  });

  expect(result.name).toBe("First Card");
  expect(result.photoURL).toBe("https://example.invalid/first.png");
});

test("root fields are used only when no profile card exists", () => {
  expect(resolvePublicProfilePresentation(rootProfile, null)).toEqual(
    rootProfile,
  );
  expect(
    resolvePublicProfilePresentation(rootProfile, {
      components: [{ type: "text", content: { text: "Hello" } }],
    }),
  ).toEqual(rootProfile);
});
