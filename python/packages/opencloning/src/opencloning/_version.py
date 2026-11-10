from importlib.metadata import version, PackageNotFoundError

try:
    __version__ = version(__name__.split('.')[0])
except PackageNotFoundError:
    # package not installed
    __version__ = '0.0.0'
