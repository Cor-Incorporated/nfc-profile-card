import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import {
  PublicLanguageProvider,
  usePublicLanguage,
} from "./PublicLanguageContext";

function LanguageConsumer() {
  const { language, setLanguage } = usePublicLanguage();

  return (
    <button type="button" onClick={() => setLanguage("en")}>
      {language}
    </button>
  );
}

describe("PublicLanguageProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("hydrates the Japanese server snapshot before applying stored English", async () => {
    window.localStorage.setItem("userLanguage", "en");
    const container = document.createElement("div");
    container.innerHTML = '<button type="button">ja</button>';
    document.body.appendChild(container);
    const recoverableErrors: unknown[] = [];
    let root: Root | undefined;

    await act(async () => {
      root = hydrateRoot(
        container,
        <PublicLanguageProvider>
          <LanguageConsumer />
        </PublicLanguageProvider>,
        {
          onRecoverableError: (error) => recoverableErrors.push(error),
        },
      );
    });

    await waitFor(() => {
      expect(container).toHaveTextContent("en");
    });
    expect(recoverableErrors).toEqual([]);

    act(() => root?.unmount());
    container.remove();
  });

  it("persists an explicit language change", () => {
    render(
      <PublicLanguageProvider>
        <LanguageConsumer />
      </PublicLanguageProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "ja" }));

    expect(screen.getByRole("button", { name: "en" })).toBeInTheDocument();
    expect(window.localStorage.getItem("userLanguage")).toBe("en");
  });
});
