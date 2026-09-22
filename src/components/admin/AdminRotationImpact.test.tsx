import { render, screen } from "@testing-library/react";
import {
  AdminRotationImpact,
  getAdminRotationImpact,
} from "./AdminRotationImpact";

test("UID形式の旧URLが残ることを管理者へ示す", () => {
  const impact = getAdminRotationImpact("fixture-uid", "u_fixture-uid");

  expect(impact).toContain("/p/u_fixture-uid");
  expect(impact).toContain("ID変更後も利用できます");
  expect(impact).not.toContain("無効化の対象");

  render(<AdminRotationImpact uid="fixture-uid" username="u_fixture-uid" />);
  expect(screen.getByText(impact)).toBeInTheDocument();
});

test("通常の旧URLとUID形式の固定URLの扱いを区別する", () => {
  const impact = getAdminRotationImpact("fixture-uid", "old-id");

  expect(impact).toContain("/p/old-id は無効化の対象");
  expect(impact).toContain("/p/u_fixture-uid は引き続き利用できます");
});
