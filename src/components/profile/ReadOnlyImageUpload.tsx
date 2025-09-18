import DOMPurify from "dompurify";

interface ReadOnlyImageUploadProps {
  src?: string;
  alt?: string;
  width?: string;
  height?: string;
  objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down";
}

export const ReadOnlyImageUpload = ({
  src = "",
  alt = "画像",
  width = "200px",
  height = "200px",
  objectFit = "cover",
}: ReadOnlyImageUploadProps) => {
  // altテキストをサニタイズ
  const sanitizedAlt = DOMPurify.sanitize(alt, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });

  if (!src) {
    return (
      <div
        className="bg-gray-200 rounded-lg flex items-center justify-center text-gray-500"
        style={{
          width: width,
          height: height,
        }}
      >
        <span>画像なし</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={sanitizedAlt}
      className="rounded-lg"
      style={{
        width: width,
        height: height,
        objectFit: objectFit,
      }}
      onError={(e) => {
        // 画像の読み込みに失敗した場合のフォールバック
        const target = e.target as HTMLImageElement;
        target.style.display = "none";
        const fallback = document.createElement("div");
        fallback.className =
          "bg-gray-200 rounded-lg flex items-center justify-center text-gray-500";
        fallback.style.width = width;
        fallback.style.height = height;
        fallback.textContent = "画像の読み込みに失敗しました";
        target.parentNode?.insertBefore(fallback, target);
      }}
    />
  );
};
