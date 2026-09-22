import { fireEvent, render, screen } from "@testing-library/react";
import type { ProfileComponent } from "../simple-editor/utils/dataStructure";
import { ReadOnlyProfileInfo } from "./ReadOnlyProfileInfo";
import { VCardButton } from "./VCardButton";

jest.mock("./VCardButton", () => ({
  VCardButton: jest.fn(() => <button>Download contact</button>),
}));

describe("ReadOnlyProfileInfo address", () => {
  it("renders old repeated address data only once", () => {
    const component: ProfileComponent = {
      id: "profile-test",
      type: "profile",
      order: 0,
      content: {
        name: "Test Person",
        postalCode: "100-0001",
        city: "東京都千代田区",
        address: "100-0001 東京都千代田区 100-0001 東京都千代田区千代田1-1",
      },
    };

    render(<ReadOnlyProfileInfo component={component} />);
    fireEvent.click(screen.getByRole("button", { name: "詳細情報を表示" }));

    expect(
      screen.getByText("〒100-0001 東京都千代田区千代田1-1"),
    ).toBeInTheDocument();
    expect(
      jest.mocked(VCardButton).mock.calls[0][0].profileData?.workAddress,
    ).toEqual(
      expect.objectContaining({
        postalCode: "100-0001",
        city: "東京都千代田区",
        street: "千代田1-1",
      }),
    );
  });
});
