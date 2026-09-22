import { fireEvent, render, screen } from "@testing-library/react";
import type { ProfileComponent } from "../simple-editor/utils/dataStructure";
import { ReadOnlyProfileInfo } from "./ReadOnlyProfileInfo";
import { VCardButton } from "./VCardButton";
import { syncBasicProfileContent } from "@/lib/profile/syncBasicProfile";

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
        postalCode: "",
        city: "",
        street: "100-0001 東京都千代田区千代田1-1",
      }),
    );
  });

  it("keeps a city-like facility name intact in vCard street", () => {
    render(
      <ReadOnlyProfileInfo
        component={{
          id: "facility",
          type: "profile",
          order: 0,
          content: {
            postalCode: "12345",
            city: "架空市",
            address: "12345 架空市民会館5",
          },
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "詳細情報を表示" }));
    expect(screen.getByText("〒12345 架空市民会館5")).toBeInTheDocument();
    expect(
      jest.mocked(VCardButton).mock.calls.at(-1)?.[0].profileData?.workAddress,
    ).toEqual({
      postalCode: "",
      city: "",
      street: "12345 架空市民会館5",
      countryRegion: "日本",
    });
  });

  it("hides contact details removed by a basic edit", () => {
    const content = syncBasicProfileContent(
      {
        name: "Old Name",
        email: "old@example.test",
        phone: "000-1111",
        cellPhone: "000-2222",
        bio: "Old bio",
        photoURL: "https://example.test/old.png",
      },
      { name: "", email: "", phone: "", bio: "", photoURL: "" },
      true,
    );
    render(
      <ReadOnlyProfileInfo
        component={{
          id: "cleared",
          type: "profile",
          order: 0,
          content: content as ProfileComponent["content"],
        }}
      />,
    );

    expect(screen.getByText("名前未設定")).toBeInTheDocument();
    expect(screen.queryByText("old@example.test")).not.toBeInTheDocument();
    expect(screen.queryByText("000-1111")).not.toBeInTheDocument();
    expect(screen.queryByText("000-2222")).not.toBeInTheDocument();
    expect(screen.queryByText("Old bio")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
