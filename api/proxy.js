// api/proxy.js
export const config = {
  runtime: "edge",
};

export default async function handler(request) {
  // Handle CORS preflight requests
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    // Only allow POST requests
    // if (request.method !== "POST") {
    //   return new Response(JSON.stringify({ error: "Method not allowed" }), {
    //     status: 405,
    //     headers: {
    //       "Content-Type": "application/json",
    //       "Access-Control-Allow-Origin": "*",
    //     },
    //   });
    // }

    const incoming = await request.json();
    const { url, method = "GET", headers = {}, body = null } = incoming;

    if (!url) {
      return new Response(JSON.stringify({ error: "Missing 'url' field" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Handle body formats (object, array, string)
    let normalizedBody = null;

    if (Array.isArray(body)) {
      // Convert [{ key, value }] → { key: value }
      normalizedBody = {};
      body.forEach(({ key, value }) => {
        if (key !== undefined) {
          normalizedBody[key] = value;
        }
      });
    } else {
      // If body is already object or string
      normalizedBody = body;
    }

    // Create safe headers - support both object and array formats
    const safeHeaders = new Headers();

    if (Array.isArray(headers)) {
      headers.forEach(({ key, value }) => {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey !== "host" &&
          lowerKey !== "content-length" &&
          !lowerKey.startsWith("cf-")
        ) {
          safeHeaders.set(key, value);
        }
      });
    } else {
      for (const key in headers) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey !== "host" &&
          lowerKey !== "content-length" &&
          !lowerKey.startsWith("cf-")
        ) {
          safeHeaders.set(key, headers[key]);
        }
      }
    }

    // Add a default User-Agent if missing
    if (!safeHeaders.has("User-Agent")) {
      safeHeaders.set(
        "User-Agent",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      );
    }

    const fetchOptions = {
      method: method,
      headers: safeHeaders,
    };

    // Only add body for methods that support it
    if (
      normalizedBody &&
      ["POST", "PUT", "PATCH"].includes(method.toUpperCase())
    ) {
      fetchOptions.body = JSON.stringify(normalizedBody);
    }

    const response = await fetch(url, fetchOptions);
    const responseText = await response.text();

    // Copy response headers back (filter out security headers)
    const outgoingHeaders = new Headers({
      "Content-Type": response.headers.get("Content-Type") || "text/plain",
      "Access-Control-Allow-Origin": "*",
    });

    for (const [key, value] of response.headers.entries()) {
      const lowerKey = key.toLowerCase();
      if (!["set-cookie", "content-encoding"].includes(lowerKey)) {
        outgoingHeaders.set(key, value);
      }
    }

    return new Response(responseText, {
      status: response.status,
      headers: outgoingHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}
