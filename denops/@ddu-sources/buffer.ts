import {
  ActionArguments,
  ActionFlags,
  BaseSource,
  Context,
  Item,
} from "https://deno.land/x/ddu_vim@v3.10.3/types.ts";
import type { Denops } from "https://deno.land/x/ddu_vim@v3.10.3/deps.ts";
import { fn } from "https://deno.land/x/ddu_vim@v3.10.3/deps.ts";
import {
  isAbsolute,
  relative,
} from "https://deno.land/std@0.221.0/path/mod.ts#^";
import { isURL } from "https://deno.land/x/is_url@v1.0.1/mod.ts";

type ActionData = {
  bufNr: number;
  path: string;
  isCurrent: boolean;
  isAlternate: boolean;
  isModified: boolean;
  isTerminal: boolean;
  bufType: string;
};

type ActionInfo = {
  word: string;
  action: ActionData;
};

type BufInfo = {
  bufnr: number;
  changed: boolean;
  lastused: number;
  listed: boolean;
  name: string;
};

type GetBufInfoReturn = {
  currentDir: string;
  alternateBufNr: number;
  buffers: BufInfo[];
};

type Params = {
  orderby: string;
};

const NO_NAME_BUFFER_DISPLAY_NAME = "[No Name]";

export class Source extends BaseSource<Params> {
  kind = "file";

  gather(args: {
    denops: Denops;
    context: Context;
    sourceParams: Params;
  }): ReadableStream<Item<ActionData>[]> {
    const currentBufNr = args.context.bufNr;

    const getDisplayPath = (fullPath: string, currentDir: string): string => {
      const relPath = relative(currentDir, fullPath);
      return relPath.startsWith("..") ? fullPath : relPath;
    };

    const getActioninfo = async (
      bufinfo: BufInfo,
      curnr_: number,
      altnr_: number,
      currentDir: string,
    ): Promise<ActionInfo> => {
      const { bufnr, changed, name } = bufinfo;
      const uBufType = await fn.getbufvar(args.denops, bufnr, "&buftype");
      const bufType = (typeof uBufType == "string") ? uBufType : "";

      // Only vim has termSet, Only neovim has name "term://...".
      const isTerminal = bufType === "terminal";

      // Windows absolute paths are recognized as URL.
      const isPathName = !isTerminal && (!isURL(name) || isAbsolute(name));

      const isCurrent_ = curnr_ === bufnr;
      const isAlternate_ = altnr_ === bufnr;
      const isModified_ = changed;

      const curmarker_ = isCurrent_ ? "%" : "";
      const altmarker_ = isAlternate_ ? "#" : "";
      const modmarker_ = isModified_ ? "+" : " ";

      const bufnrstr_ = String(bufnr).padStart(2, " ");
      const bufmark_ = `${curmarker_}${altmarker_}`.padStart(2, " ");

      const displayName = name === ""
        ? NO_NAME_BUFFER_DISPLAY_NAME
        : isPathName
        ? getDisplayPath(name, currentDir)
        : name;

      return {
        word: `${bufnrstr_} ${bufmark_} ${modmarker_} ${displayName}`,
        action: {
          bufNr: bufnr,
          path: name,
          isCurrent: isCurrent_,
          isAlternate: isAlternate_,
          isModified: isModified_,
          isTerminal,
          bufType,
        },
      };
    };

    const getBuflist = async () => {
      const {
        currentDir,
        alternateBufNr,
        buffers,
      } = await args.denops.call(
        "ddu#source#buffer#getbufinfo",
      ) as GetBufInfoReturn;
      return await Promise.all(
        buffers.filter((b) => b.listed).sort((a, b) => {
          if (args.sourceParams.orderby === "desc") {
            if (a.bufnr === currentBufNr) return 1;
            if (b.bufnr === currentBufNr) return -1;
            return Number(BigInt(b.lastused) - BigInt(a.lastused));
          }

          return Number(BigInt(a.lastused) - BigInt(b.lastused));
        }).map(async (b) =>
          await getActioninfo(b, currentBufNr, alternateBufNr, currentDir)
        ),
      );
    };

    return new ReadableStream({
      async start(controller) {
        controller.enqueue(
          await getBuflist(),
        );
        controller.close();
      },
    });
  }

  actions = {
    delete: async ({ denops, items }: ActionArguments<Params>) => {
      try {
        for (const item of items) {
          const action = item.action as ActionData;
          const existed = await fn.bufexists(denops, action.bufNr);
          if (!existed) {
            throw new Error(
              `the buffer doesn't exist> ${action.bufNr}: ${action.path}`,
            );
          }

          const bufinfo = await denops.call(
            "getbufinfo",
            action.bufNr,
          ) as BufInfo[];
          if (bufinfo.length && !bufinfo[0].changed) {
            await denops.cmd(`bwipeout ${action.bufNr}`);
          } else {
            throw new Error(
              `can't delete the buffer> ${action.bufNr}: ${action.path}`,
            );
          }
        }
      } catch (err) {
        console.error(err.message);
        return Promise.resolve(ActionFlags.None);
      }

      return Promise.resolve(ActionFlags.RefreshItems);
    },
  };

  params(): Params {
    return {
      orderby: "asc",
    };
  }
}
