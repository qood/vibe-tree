import { useEffect } from "react";

const APP_NAME = "Vibe Tree";

/**
 * ドキュメントタイトルを動的に設定するカスタムフック
 * @param pageTitle - ページ固有のタイトル（例: "ダッシュボード"）
 *                    nullまたはundefinedの場合はアプリ名のみ表示
 */
export function useDocumentTitle(pageTitle: string | null | undefined): void {
  useEffect(() => {
    const previousTitle = document.title;

    if (pageTitle) {
      document.title = `${pageTitle} | ${APP_NAME}`;
    } else {
      document.title = APP_NAME;
    }

    return () => {
      document.title = previousTitle;
    };
  }, [pageTitle]);
}
