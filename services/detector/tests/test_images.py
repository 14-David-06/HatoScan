import httpx
import pytest

from app.api.images import (
    ImageDownloadError,
    ImageHostNotAllowedError,
    check_image_url,
    download_image,
)

ALLOWED = ["app.hatoscan.test", "localhost"]


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.mark.parametrize(
    "url",
    [
        "https://app.hatoscan.test/api/files/a.jpg?expires=1&signature=x",
        "http://localhost:3000/api/files/a.jpg",
        "https://APP.HATOSCAN.TEST/a.jpg",
    ],
)
def test_allowed_hosts_pass(url: str) -> None:
    check_image_url(url, ALLOWED)


@pytest.mark.parametrize(
    "url",
    [
        "https://evil.test/a.jpg",
        "http://169.254.169.254/latest/meta-data/",
        "http://127.0.0.1:8000/health",
        "https://app.hatoscan.test.evil.test/a.jpg",
        "file:///etc/passwd",
        "ftp://app.hatoscan.test/a.jpg",
        "not a url",
    ],
)
def test_other_hosts_and_schemes_are_rejected(url: str) -> None:
    with pytest.raises(ImageHostNotAllowedError):
        check_image_url(url, ALLOWED)


def test_empty_allow_list_rejects_everything() -> None:
    with pytest.raises(ImageHostNotAllowedError):
        check_image_url("https://app.hatoscan.test/a.jpg", [])


async def download(transport: httpx.AsyncBaseTransport, max_bytes: int = 10) -> bytes:
    return await download_image(
        "http://localhost/a.jpg",
        allowed_hosts=ALLOWED,
        max_bytes=max_bytes,
        timeout_s=1,
        transport=transport,
    )


@pytest.mark.anyio
async def test_download_does_not_follow_redirects() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "localhost":
            return httpx.Response(302, headers={"location": "http://169.254.169.254/x"})
        return httpx.Response(200, content=b"secret")

    with pytest.raises(ImageDownloadError):
        await download(httpx.MockTransport(handler))


@pytest.mark.anyio
async def test_download_enforces_the_size_limit_and_returns_bytes() -> None:
    transport = httpx.MockTransport(lambda _r: httpx.Response(200, content=b"\xff\xd8" * 4))
    assert await download(transport, max_bytes=8) == b"\xff\xd8" * 4
    with pytest.raises(ImageDownloadError):
        await download(transport, max_bytes=7)
