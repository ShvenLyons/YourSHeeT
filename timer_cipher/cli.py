"""Command line interface for TimeR."""

from __future__ import annotations

import argparse
import sys

from .core import decrypt_code, encrypt_interval


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="timer",
        description="Encrypt and decrypt HH:MM-HH:MM ranges as four-letter codes.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    encrypt = subparsers.add_parser("encrypt", help="Encrypt a time range.")
    encrypt.add_argument("--key", default="dog", help="Shared secret key.")
    encrypt.add_argument("--start", required=True, help="Start time, for example 19:26.")
    encrypt.add_argument("--end", required=True, help="End time, for example 19:30.")

    decrypt = subparsers.add_parser("decrypt", help="Decrypt a four-letter code.")
    decrypt.add_argument("--key", default="dog", help="Shared secret key.")
    decrypt.add_argument("--code", required=True, help="Four-letter ciphertext.")

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        if args.command == "encrypt":
            print(encrypt_interval(args.start, args.end, args.key))
        elif args.command == "decrypt":
            print(decrypt_code(args.code, args.key))
        else:
            parser.error(f"unknown command: {args.command}")
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    return 0
