"""Sample Android battery temperature, thermal status and the main Chrome process over USB."""
import argparse
import json
import os
import re
import signal
import subprocess
import sys
import tempfile
import time
from contextlib import ExitStack, contextmanager
from datetime import datetime, timezone
from pathlib import Path


def adb(*args):
    return subprocess.check_output(
        ["adb", *args], text=True, stderr=subprocess.PIPE, timeout=12
    ).strip()


def connected_phone(requested):
    try:
        if not requested:
            return adb("-d", "get-serialno")
        if adb("-s", requested, "get-devpath").startswith("usb:"):
            return requested
    except subprocess.CalledProcessError:
        pass
    raise ValueError("USB 디버깅을 허용한 Android 휴대폰 한 대를 연결하거나 --serial로 선택하세요.")


@contextmanager
def chrome_forwarding(serial):
    def device(*args):
        return adb("-s", serial, *args)

    def cleanup(*args):
        try:
            device(*args)
        except subprocess.SubprocessError:
            print("USB 연결 상태 때문에 임시 포트를 해제하지 못했습니다.", file=sys.stderr)

    with ExitStack() as stack:
        forwards = [line.split()[-2:] for line in device("reverse", "--list").splitlines()]
        for port in (4310, 4360, 4361, 54321):
            endpoint = f"tcp:{port}"
            if [endpoint, endpoint] in forwards:
                continue
            device("reverse", "--no-rebind", endpoint, endpoint)
            stack.callback(cleanup, "reverse", "--remove", endpoint)
        cdp_port = device("forward", "tcp:0", "localabstract:chrome_devtools_remote")
        if not cdp_port.isdigit():
            raise ValueError("Chrome 디버깅 포트 번호를 확인할 수 없습니다.")
        stack.callback(cleanup, "forward", "--remove", "tcp:" + cdp_port)
        yield cdp_port


def number(text, pattern):
    match = re.search(pattern, text, re.MULTILINE)
    return int(match.group(1).replace(",", "")) if match else None


def sample(shell):
    temp = number(shell("dumpsys", "battery"), r"^\s*temperature:\s*(-?\d+)\s*$")
    thermal = number(shell("dumpsys", "thermalservice"), r"^\s*Thermal Status:\s*(\d+)\s*$")
    try:
        processes = shell("pidof", "com.android.chrome").split()
    except subprocess.CalledProcessError as error:
        if error.returncode != 1 or (error.stderr or "").strip():
            raise
        processes = []
    if len(processes) != 1 or not processes[0].isdigit():
        raise ValueError("휴대폰의 Chrome을 열고 측정을 다시 시작하세요.")
    memory = shell("dumpsys", "meminfo", processes[0])
    pss = number(memory, r"\bTOTAL PSS:\s*([\d,]+)")
    if pss is None:
        pss = number(memory, r"^\s*TOTAL\s+([\d,]+)\s")
    return {"batteryCelsius": None if temp is None else temp / 10, "thermalStatus": thermal,
            "chromeMainPid": int(processes[0]), "chromeMainPssKiB": pss}


def write_report(path, report):
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    tmp.replace(path)


def take_readings(shell, seconds, interval, path, report, child=None):
    start = time.monotonic()
    next_sample = start
    while True:
        time.sleep(max(0, next_sample - time.monotonic()))
        elapsed = time.monotonic() - start
        report["samples"].append({"elapsedSeconds": round(elapsed, 2), **sample(shell)})
        write_report(path, report)
        if child is not None:
            if child.poll() is not None:
                if child.returncode:
                    raise RuntimeError("3D 풀이 검사가 실패했습니다. endurance.log를 확인하세요.")
                break
            if elapsed > 1200:
                raise RuntimeError("3D 풀이 검사가 20분 안에 끝나지 않았습니다.")
        elif elapsed >= seconds:
            break
        next_sample = max(next_sample + interval, time.monotonic())
        if child is None:
            next_sample = min(start + seconds, next_sample)


@contextmanager
def keep_usb_screen_awake(shell):
    # Keep Android's user-selected charging policy after the USB session.
    key = "stay_on_while_plugged_in"
    previous = shell("settings", "get", "global", key)
    if previous != "null" and not previous.isdigit():
        raise ValueError("Android 화면 유지 설정을 읽지 못했습니다.")
    value = int(previous) if previous.isdigit() else 0
    changed = not value & 2
    if changed:
        shell("settings", "put", "global", key, str(value | 2))
    try:
        shell("input", "keyevent", "KEYCODE_WAKEUP")
        deadline = time.monotonic() + 180
        while re.search(r"^\s*showing=true\s*$", shell("dumpsys", "window", "policy"), re.M):
            if time.monotonic() > deadline:
                raise ValueError("휴대폰 잠금 해제가 필요합니다.")
            time.sleep(2)
        yield
    finally:
        if changed:
            if previous == "null":
                shell("settings", "delete", "global", key)
            else:
                shell("settings", "put", "global", key, previous)
        if shell("settings", "get", "global", key) != previous:
            raise RuntimeError("Could not restore the original USB screen policy.")


def verify_flow(serial, shell, interval, path, report, stage):
    repo = Path(__file__).resolve().parents[1]
    with chrome_forwarding(serial) as port:
        env = {**os.environ, "CBT_USB_CHROME_PORT": port, "CBT_USB_SERIAL": serial, "CBT_TEST_URL": "http://127.0.0.1:4310/",
               "CBT_BOOK_SOURCE": "static", "CBT_BOOK_ROUTE": "first-visit", "CBT_BOOK_PWA": "1",
               "CBT_STUDY_ENDURANCE": "1"}
        for log, script in [("first-answer.jsonl", "measure-textbook-mobile.mjs"),
                            ("sync.log", "verify-local-supabase.mjs")]:
            if stage not in ("all", log.split(".")[0]):
                continue
            with (path.parent / log).open("w") as output:
                subprocess.run(["node", "tools/" + script], cwd=repo, env=env,
                               stdout=output, check=True, timeout=300)
        if stage not in ("all", "3d"):
            return
        command = ["npx", "--no-install", "playwright", "test", "tools/react-equipment-pdf.spec.ts",
                   "--project=iphone-14-pro", "--grep", "원통다관식", "--output", str(path.parent / "browser")]
        with (path.parent / "endurance.log").open("w") as log:
            child = subprocess.Popen(command, cwd=repo, env=env, stdout=log, stderr=log, start_new_session=True)
            try:
                take_readings(shell, None, interval, path, report, child)
            finally:
                if child.poll() is None:
                    os.killpg(child.pid, signal.SIGINT)
                    try:
                        child.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        os.killpg(child.pid, signal.SIGKILL)
                        child.wait()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--serial", help="ADB serial when several USB devices are connected")
    parser.add_argument("--seconds", type=int, help="Manual sampling duration (default 600)")
    parser.add_argument("--interval", type=int, default=30)
    parser.add_argument("--verify", action="store_true", help="Use Android Chrome for both books, sync, and the 3D workload")
    parser.add_argument("--stage", choices=("all", "first-answer", "sync", "3d"), default="all", help="Run one USB verification stage independently")
    args = parser.parse_args()
    if not args.verify and args.stage != "all":
        parser.error("--stage requires --verify")
    if args.seconds is not None and args.verify:
        parser.error("--verify samples until the browser workload finishes")
    seconds = 600 if args.seconds is None else args.seconds
    if not 0 < args.interval <= seconds:
        parser.error("측정 시간과 간격은 양수이고 간격은 측정 시간 이하여야 합니다.")
    serial = connected_phone(args.serial)

    def shell(*cmd):
        return adb("-s", serial, "shell", *cmd)

    if any(shell("getprop", key) == "1" for key in ["ro.kernel.qemu", "ro.boot.qemu"]):
        raise ValueError("실물 휴대폰 검증에는 에뮬레이터를 사용할 수 없습니다.")
    device = shell("getprop", "ro.product.model")
    android = shell("getprop", "ro.build.version.release")
    root = Path(__file__).resolve().parents[1] / "work/private-notes/android-study"
    root.mkdir(parents=True, exist_ok=True)
    path = Path(tempfile.mkdtemp(prefix="usb-", dir=root)) / "readings.json"
    report = {"device": device, "android": android, "startedUtc": datetime.now(timezone.utc).isoformat(),
              "workload": ("book-sync-3d" if args.stage == "all" else args.stage) if args.verify else "manual", "intervalSeconds": args.interval,
              "finished": False, "metricsComplete": False, "samples": []}
    print(f"{device} · Android {android}\n{path}", flush=True)
    try:
        if args.verify:
            with keep_usb_screen_awake(shell):
                verify_flow(serial, shell, args.interval, path, report, args.stage)
        else:
            take_readings(shell, seconds, args.interval, path, report)
        missing = [key for key in ("batteryCelsius", "thermalStatus", "chromeMainPssKiB")
                   if any(row[key] is None for row in report["samples"])]
        report["missingMetrics"] = missing
        report["metricsComplete"] = bool(report["samples"]) and not missing
        report["finished"] = True
        if missing:
            print("기기가 일부 값을 제공하지 않았습니다: " + ", ".join(missing), file=sys.stderr)
    finally:
        write_report(path, report)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError, OSError, subprocess.SubprocessError) as error:
        sys.exit(str(error))
