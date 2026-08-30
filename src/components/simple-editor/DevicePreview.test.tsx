import { render, screen } from "@testing-library/react";
import { DevicePreview } from "./DevicePreview";
import type { ProfileComponent } from "./utils/dataStructure";

describe("DevicePreview", () => {
  it("renders a profile VCard action within the public language provider", () => {
    const components: ProfileComponent[] = [
      {
        id: "profile",
        type: "profile",
        order: 0,
        content: {
          name: "Preview User",
          email: "preview@example.com",
        },
      },
    ];

    render(
      <DevicePreview
        profileUrl="/p/preview-user"
        components={components}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText("Preview User")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "連絡先を保存" }),
    ).toBeInTheDocument();
  });
});
