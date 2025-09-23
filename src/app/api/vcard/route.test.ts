import vCardsJS from "vcards-js";
import { GET, POST } from "./route";

// NextResponseのモック
jest.mock("next/server", () => {
  class MockResponse {
    status: number;
    headers: {
      get: (key: string) => string | null;
      set: (key: string, value: string) => void;
      has: (key: string) => boolean;
      _data: Map<string, string>;
    };
    body: any;

    constructor(body?: BodyInit | null, init?: ResponseInit) {
      this.body = body;
      this.status = init?.status || 200;

      const headersData = new Map<string, string>();
      this.headers = {
        _data: headersData,
        get: (key: string) => headersData.get(key.toLowerCase()) || null,
        set: (key: string, value: string) =>
          headersData.set(key.toLowerCase(), value),
        has: (key: string) => headersData.has(key.toLowerCase()),
      };

      if (init?.headers) {
        const h = init.headers;
        if (h instanceof Headers) {
          h.forEach((value, key) => this.headers.set(key, value));
        } else if (Array.isArray(h)) {
          h.forEach(([key, value]) => this.headers.set(key, value));
        } else if (typeof h === "object") {
          Object.entries(h).forEach(([key, value]) => {
            this.headers.set(key, value as string);
          });
        }
      }
    }

    json() {
      if (typeof this.body === "string") {
        return Promise.resolve(JSON.parse(this.body));
      }
      return Promise.resolve(this.body);
    }
  }

  class NextResponse extends MockResponse {
    static json(body: any, init?: ResponseInit) {
      const response = new MockResponse(JSON.stringify(body), {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers || {}),
        },
      });
      return response;
    }
  }

  return {
    NextResponse,
    NextRequest: jest.fn(),
  };
});

// NextRequestのモック
class MockNextRequest {
  url: string;
  method: string;
  body: ReadableStream | null;
  headers: Headers;
  nextUrl: {
    searchParams: URLSearchParams;
  };
  cookies: any;
  geo: any;
  ip: any;
  page: any;
  ua: any;
  internals: any;
  cache: any;
  credentials: any;
  destination: any;
  integrity: any;
  keepalive: any;
  mode: any;
  redirect: any;
  referrer: any;
  referrerPolicy: any;
  signal: any;
  duplex: any;
  bodyUsed: boolean;
  bytes: any;

  constructor(url: string, options: any = {}) {
    this.url = url;
    this.method = options.method || "GET";
    this.headers = new Headers(options.headers || {});
    this.cookies = options.cookies || {};
    this.geo = options.geo || {};
    this.ip = options.ip || "127.0.0.1";
    this.page = options.page || {};
    this.ua = options.ua || "";
    this.internals = options.internals || {};
    this.cache = options.cache || "default";
    this.bodyUsed = false;
    this.bytes = options.bytes || null;
    this.credentials = options.credentials || "same-origin";
    this.destination = options.destination || "";
    this.integrity = options.integrity || "";
    this.keepalive = options.keepalive || false;
    this.mode = options.mode || "cors";
    this.redirect = options.redirect || "follow";
    this.referrer = options.referrer || "about:client";
    this.referrerPolicy = options.referrerPolicy || "";
    this.signal = options.signal || null;
    this.duplex = options.duplex || "half";

    const urlObj = new URL(url);
    this.nextUrl = {
      searchParams: urlObj.searchParams,
    };

    if (options.body) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(options.body));
          controller.close();
        },
      });
      this.body = stream;
    } else {
      this.body = null;
    }
  }

  async json() {
    if (this.body) {
      const reader = this.body.getReader();
      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);
      // 空文字列チェックを追加
      if (!text || text.trim() === "") {
        return {};
      }
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error("JSON parse error:", e);
        return {};
      }
    }
    return {};
  }

  async text() {
    if (this.body) {
      const reader = this.body.getReader();
      const { value } = await reader.read();
      return new TextDecoder().decode(value);
    }
    return "";
  }

  async arrayBuffer() {
    if (this.body) {
      const reader = this.body.getReader();
      const { value } = await reader.read();
      return value.buffer;
    }
    return new ArrayBuffer(0);
  }

  async blob() {
    return new Blob();
  }

  async formData() {
    return new FormData();
  }

  clone() {
    return new MockNextRequest(this.url, { method: this.method });
  }
}

// vCardsJSのモック
jest.mock("vcards-js", () => {
  return jest.fn(() => ({
    firstName: "",
    lastName: "",
    organization: "",
    title: "",
    email: "",
    workPhone: "",
    cellPhone: "",
    url: "",
    note: "",
    version: "",
    workAddress: {
      street: "",
      city: "",
      stateProvince: "",
      postalCode: "",
      countryRegion: "",
    },
    socialUrls: {
      facebook: "",
      linkedIn: "",
      twitter: "",
      instagram: "",
    },
    photo: {
      embedFromString: jest.fn(),
    },
    getFormattedString: jest.fn(
      () => "BEGIN:VCARD\nVERSION:3.0\nN:Doe;John;;;\nFN:John Doe\nEND:VCARD",
    ),
  }));
});

// fetchのモック
global.fetch = jest.fn();

describe("VCard API Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/vcard", () => {
    it("基本的なVCardを生成できる", async () => {
      const requestData = {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        organization: "Example Corp",
        title: "Developer",
      };

      const request = new MockNextRequest("http://localhost:3000/api/vcard", {
        method: "POST",
        body: JSON.stringify(requestData),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request as any);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe(
        "text/vcard;charset=utf-8",
      );
      expect(response.headers.get("Content-Disposition")).toContain(
        'attachment; filename="John_Doe.vcf"',
      );

      const vCardInstance = (vCardsJS as jest.Mock).mock.results[0].value;
      expect(vCardInstance.firstName).toBe("John");
      expect(vCardInstance.lastName).toBe("Doe");
      expect(vCardInstance.email).toBe("john@example.com");
      expect(vCardInstance.organization).toBe("Example Corp");
      expect(vCardInstance.title).toBe("Developer");
    });

    it("完全なプロファイルデータでVCardを生成できる", async () => {
      const requestData = {
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
        organization: "Tech Inc",
        title: "CEO",
        workPhone: "03-1234-5678",
        cellPhone: "090-1234-5678",
        url: "https://example.com",
        workAddress: {
          street: "123 Main St",
          city: "Tokyo",
          stateProvince: "Tokyo",
          postalCode: "100-0001",
          countryRegion: "Japan",
        },
        socialUrls: {
          facebook: "https://facebook.com/jane",
          linkedIn: "https://linkedin.com/in/jane",
          twitter: "https://twitter.com/jane",
          instagram: "https://instagram.com/jane",
        },
        photo: "data:image/jpeg;base64,/9j/4AAQSkZJRg",
        note: "This is a test note",
      };

      const request = new MockNextRequest("http://localhost:3000/api/vcard", {
        method: "POST",
        body: JSON.stringify(requestData),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request as any);

      expect(response.status).toBe(200);

      const vCardInstance = (vCardsJS as jest.Mock).mock.results[0].value;
      expect(vCardInstance.workAddress.street).toBe("123 Main St");
      expect(vCardInstance.workAddress.city).toBe("Tokyo");
      expect(vCardInstance.socialUrls.linkedIn).toBe(
        "https://linkedin.com/in/jane",
      );
      expect(vCardInstance.photo.embedFromString).toHaveBeenCalledWith(
        "data:image/jpeg;base64,/9j/4AAQSkZJRg",
        "image/jpeg",
      );
      expect(vCardInstance.note).toBe("This is a test note");
    });

    it("最小限のデータでもVCardを生成できる", async () => {
      const requestData = {};

      const request = new MockNextRequest("http://localhost:3000/api/vcard", {
        method: "POST",
        body: JSON.stringify(requestData),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request as any);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Disposition")).toContain(
        'attachment; filename="contact_card.vcf"',
      );
    });

    it("不正なJSONデータでエラーを返す", async () => {
      const request = new MockNextRequest("http://localhost:3000/api/vcard", {
        method: "POST",
        body: "invalid json",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to generate VCard");
    });

    it("vCard生成エラー時に500エラーを返す", async () => {
      (vCardsJS as jest.Mock).mockImplementationOnce(() => ({
        getFormattedString: jest.fn(() => {
          throw new Error("VCard generation error");
        }),
      }));

      const requestData = {
        firstName: "Test",
        lastName: "User",
      };

      const request = new MockNextRequest("http://localhost:3000/api/vcard", {
        method: "POST",
        body: JSON.stringify(requestData),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to generate VCard");
    });
  });

  describe("GET /api/vcard", () => {
    it("usernameパラメータでプロファイルを取得してVCardを生成", async () => {
      const mockProfile = {
        name: "John Doe",
        email: "john@example.com",
        company: "Example Corp",
        position: "Developer",
        phone: "03-1234-5678",
        mobile: "090-1234-5678",
        website: "https://example.com",
        address: "123 Main St",
        postalCode: "100-0001",
        bio: "Software Developer",
        links: [
          { url: "https://linkedin.com/in/johndoe" },
          { url: "https://twitter.com/johndoe" },
          { url: "https://facebook.com/johndoe" },
          { url: "https://instagram.com/johndoe" },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => mockProfile,
      });

      const request = new MockNextRequest(
        "http://localhost:3000/api/vcard?username=johndoe",
        {
          method: "GET",
        },
      );

      const response = await GET(request as any);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe(
        "text/vcard;charset=utf-8",
      );
      expect(response.headers.get("Content-Disposition")).toContain(
        'attachment; filename="johndoe.vcf"',
      );

      const vCardInstance = (vCardsJS as jest.Mock).mock.results[0].value;
      expect(vCardInstance.firstName).toBe("John");
      expect(vCardInstance.lastName).toBe("Doe");
      expect(vCardInstance.email).toBe("john@example.com");
      expect(vCardInstance.organization).toBe("Example Corp");
      expect(vCardInstance.socialUrls.linkedIn).toBe(
        "https://linkedin.com/in/johndoe",
      );
    });

    it("X(旧Twitter)のURLを正しく処理する", async () => {
      const mockProfile = {
        name: "Test User",
        links: [{ url: "https://x.com/testuser" }],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => mockProfile,
      });

      const request = new MockNextRequest(
        "http://localhost:3000/api/vcard?username=testuser",
        {
          method: "GET",
        },
      );

      const response = await GET(request as any);

      expect(response.status).toBe(200);

      const vCardInstance = (vCardsJS as jest.Mock).mock.results[0].value;
      expect(vCardInstance.socialUrls.twitter).toBe("https://x.com/testuser");
    });

    it("名前が複数の部分から成る場合の処理", async () => {
      const mockProfile = {
        name: "John Michael Doe Smith",
        email: "john@example.com",
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => mockProfile,
      });

      const request = new MockNextRequest(
        "http://localhost:3000/api/vcard?username=johndoe",
        {
          method: "GET",
        },
      );

      const response = await GET(request as any);

      expect(response.status).toBe(200);

      const vCardInstance = (vCardsJS as jest.Mock).mock.results[0].value;
      expect(vCardInstance.firstName).toBe("John");
      expect(vCardInstance.lastName).toBe("Michael Doe Smith");
    });

    it("必須フィールドが存在しない場合でも処理できる", async () => {
      const mockProfile = {};

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => mockProfile,
      });

      const request = new MockNextRequest(
        "http://localhost:3000/api/vcard?username=emptyuser",
        {
          method: "GET",
        },
      );

      const response = await GET(request as any);

      expect(response.status).toBe(200);

      const vCardInstance = (vCardsJS as jest.Mock).mock.results[0].value;
      expect(vCardInstance.firstName).toBe("");
      expect(vCardInstance.lastName).toBe("");
      expect(vCardInstance.email).toBe("");
    });

    it("usernameパラメータがない場合400エラーを返す", async () => {
      const request = new MockNextRequest("http://localhost:3000/api/vcard", {
        method: "GET",
      });

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Username required");
    });

    it("プロファイルが見つからない場合404エラーを返す", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => null,
      });

      const request = new MockNextRequest(
        "http://localhost:3000/api/vcard?username=notfound",
        {
          method: "GET",
        },
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Profile not found");
    });

    it("プロファイルAPI呼び出しが失敗した場合500エラーを返す", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("API Error"));

      const request = new MockNextRequest(
        "http://localhost:3000/api/vcard?username=error",
        {
          method: "GET",
        },
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to generate VCard");
    });

    it("vCard生成中にエラーが発生した場合500エラーを返す", async () => {
      const mockProfile = {
        name: "Test User",
        email: "test@example.com",
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => mockProfile,
      });
      (vCardsJS as jest.Mock).mockImplementationOnce(() => ({
        firstName: "",
        lastName: "",
        getFormattedString: jest.fn(() => {
          throw new Error("VCard formatting error");
        }),
      }));

      const request = new MockNextRequest(
        "http://localhost:3000/api/vcard?username=erroruser",
        {
          method: "GET",
        },
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to generate VCard");
    });
  });
});
