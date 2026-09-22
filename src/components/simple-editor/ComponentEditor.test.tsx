import { fireEvent, render, screen } from "@testing-library/react";
import { ComponentEditor } from "./ComponentEditor";
import type { ProfileComponent } from "./utils/dataStructure";
import { sanitizeComponentContent } from "./utils/validation";

jest.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("./ImageUploader", () => ({ ImageUploader: () => null }));

const blankPublicFields = {
  firstName: "",
  lastName: "",
  phoneticFirstName: "",
  phoneticLastName: "",
  name: "",
  email: "",
  phone: "",
  cellPhone: "",
  company: "",
  position: "",
  department: "",
  address: "",
  city: "",
  postalCode: "",
  website: "",
  bio: "",
  photoURL: "",
};

function profileComponent(
  content: ProfileComponent["content"],
): ProfileComponent {
  return { id: "profile", type: "profile", order: 0, content };
}

describe("profile component style save", () => {
  it("keeps untouched empty public keys when only the color changes", () => {
    const onSave = jest.fn();
    render(
      <ComponentEditor
        component={profileComponent({
          ...blankPublicFields,
          cardBackgroundColor: "#ffffff",
          cardBackgroundOpacity: 95,
        })}
        onSave={onSave}
        onClose={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle("blue"));
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    const saved = onSave.mock.calls[0][0] as ProfileComponent;
    const persisted = sanitizeComponentContent("profile", saved.content);
    expect(persisted).toMatchObject({
      ...blankPublicFields,
      cardBackgroundColor: "#3b82f6",
    });
  });

  it("does not invent public values for an already cleared component", () => {
    const onSave = jest.fn();
    render(
      <ComponentEditor
        component={profileComponent({
          cardBackgroundColor: "#ffffff",
          cardBackgroundOpacity: 95,
        })}
        onSave={onSave}
        onClose={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle("blue"));
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    const saved = onSave.mock.calls[0][0] as ProfileComponent;
    const persisted = sanitizeComponentContent("profile", saved.content);
    expect(persisted).toEqual({
      cardBackgroundColor: "#3b82f6",
      cardBackgroundOpacity: 95,
    });
  });
});
