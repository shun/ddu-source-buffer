import {
  ActionArguments,
  ActionFlags,
  BaseSource,
  Context,
  Item,
} from "https://deno.land/x/ddu_vim@v1.13.0/types.ts";
import type { Denops } from "https://deno.land/x/ddu_vim@v1.13.0/deps.ts";
import { fn } from "https://deno.land/x/ddu_vim@v1.13.0/deps.ts";
import { relative } from "https://deno.land/std@0.165.0/path/mod.ts#^";

type ActionData = {
  bufNr: number;
  path: string;
  isCurrent: boolean;
  isAlternate: boolean;
  isModified: boolean;
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

export class Source extends BaseSource<Params> {
  kind = "file";

  gather(args: {
    denops: Denops;
    context: Context;
    sourceParams: Params;
  }): ReadableStream<Item<ActionData>[]> {
    const currentBufNr = args.context.bufNr;
    const getActioninfo = (
      bufinfo: BufInfo,
      curnr_: number,
      altnr_: number,
      currentDir: string,
    ): ActionInfo => {
      const isCurrent_ = curnr_ === bufinfo.bufnr;
      const isAlternate_ = altnr_ === bufinfo.bufnr;
      const isModified_ = bufinfo.changed;

      const curmarker_ = isCurrent_ ? "%" : "";
      const altmarker_ = isAlternate_ ? "#" : "";
      const modmarker_ = isModified_ ? "+" : " ";

      const bufnrstr_ = String(bufinfo.bufnr).padStart(2, " ");
      const bufmark_ = `${curmarker_}${altmarker_}`.padStart(2, " ");
      return {
        word: `${bufnrstr_} ${bufmark_} ${modmarker_} ${
          relative(currentDir, bufinfo.name)
        }`,
        action: {
          bufNr: bufinfo.bufnr,
          path: bufinfo.name,
          isCurrent: isCurrent_,
          isAlternate: isAlternate_,
          isModified: isModified_,
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

      return buffers.filter((b) => b.listed).sort((a, b) => {
        if (args.sourceParams.orderby === "desc") {
          if (a.bufnr === currentBufNr) return 1;
          if (b.bufnr === currentBufNr) return -1;
          return b.lastused - a.lastused;
        }

        return a.lastused - b.lastused;
      }).map((b) => getActioninfo(b, currentBufNr, alternateBufNr, currentDir));
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
          const existed = await fn.bufexists(denops, item.action.bufNr);
          if (!existed) {
            throw new Error(
              `the buffer doesn't exist> ${item.action.bufNr}: ${item.action.path}`,
            );
          }

          const bufinfo = await denops.call("getbufinfo", item.action.bufNr);
          if (bufinfo.length && bufinfo[0].changed === 0) {
            await denops.cmd(`bwipeout ${item.action.bufNr}`);
          } else {
            throw new Error(
              `can't delete the buffer> ${item.action.bufNr}: ${item.action.path}`,
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
