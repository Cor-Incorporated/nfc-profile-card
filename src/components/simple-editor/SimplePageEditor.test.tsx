import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { SimplePageEditor } from "./SimplePageEditor";

const mockAuthUser = { uid: "owner", getIdToken: async () => "test-token" };

jest.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mockAuthUser,
  }),
}));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("./ComponentEditor", () => ({ ComponentEditor: () => null }));
jest.mock("./BackgroundCustomizer", () => ({
  BackgroundCustomizer: () => null,
}));
jest.mock("./DevicePreview", () => ({ DevicePreview: () => null }));

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

test("shows a reload path when another tab changed the design", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 409,
    json: async () => ({ error: "design_conflict" }),
  });
  render(
    <SimplePageEditor
      userId="owner"
      initialRevision="1:000000010"
      initialData={{ components: [], updatedAt: new Date() }}
      user={{ username: "alice" }}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "addComponent" }));
  fireEvent.click(screen.getByRole("button", { name: "addText" }));
  fireEvent.click(screen.getByRole("button", { name: "manualSave" }));

  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  await waitFor(() => {
    expect(screen.getByRole("alert")).toHaveTextContent(
      "別の画面でプロフィールが更新されました",
    );
  });
  expect(
    screen.getByRole("button", { name: "再読み込みして最新の内容を確認" }),
  ).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/users/me/profile/design",
    expect.objectContaining({ method: "PUT" }),
  );
});

test("saves a new edit made while the first server request is pending", async () => {
  let releaseFirst!: () => void;
  global.fetch = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseFirst = () =>
            resolve({
              ok: true,
              status: 200,
              json: async () => ({ revision: "2:000000020" }),
            });
        }),
    )
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ revision: "3:000000030" }),
    });
  render(
    <SimplePageEditor
      userId="owner"
      initialRevision="1:000000010"
      initialData={{ components: [], updatedAt: new Date() }}
      user={{ username: "alice" }}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "addComponent" }));
  fireEvent.click(screen.getByRole("button", { name: "addText" }));
  fireEvent.click(screen.getByRole("button", { name: "manualSave" }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

  fireEvent.click(screen.getByRole("button", { name: "addComponent" }));
  fireEvent.click(screen.getByRole("button", { name: "addText" }));
  await act(async () => releaseFirst());

  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  const [, secondOptions] = (global.fetch as jest.Mock).mock.calls[1];
  expect(JSON.parse(secondOptions.body)).toMatchObject({
    revision: "2:000000020",
    components: [{ type: "text" }, { type: "text" }],
  });
  await waitFor(() => expect(screen.getByText(/savedAt/)).toBeInTheDocument());
});
