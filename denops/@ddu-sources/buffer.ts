import { BaseSource, Item } from "https://deno.land/x/ddu_vim@v1.4.0/types.ts";
import type { Denops } from "https://deno.land/x/ddu_vim@v1.4.0/deps.ts";
import { relative } from "https://deno.land/std@0.132.0/path/mod.ts#^";

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
  currentBufNr: number;
  alternateBufNr: number;
  buffers: BufInfo[];
};

type Params = Record<never, never>;

export class Source extends BaseSource<Params> {
  kind = "file";

  gather(args: {
    denops: Denops;
  }): ReadableStream<Item<ActionData>[]> {
    const get_actioninfo = (
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
      const modmarker_ = isModified_ ? "+" : "";

      return {
        word: `${bufinfo.bufnr} ${curmarker_}${altmarker_} ${modmarker_} ${
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

    const get_buflist = async () => {
      const {
        currentDir,
        currentBufNr,
        alternateBufNr,
        buffers,
      } = await args.denops.call(
        'ddu#source#buffer#getbufinfo'
      ) as GetBufInfoReturn;

      return buffers.filter((b) => b.listed).sort((a, b) => {
        return a.bufnr == currentBufNr ? -1 : a.lastused - b.lastused;
      }).map((b) => get_actioninfo(b, currentBufNr, alternateBufNr, currentDir));
    };

    return new ReadableStream({
      async start(controller) {
        controller.enqueue(
          await get_buflist(),
        );
        controller.close();
      },
    });
  }

  params(): Params {
    return {};
  }
}
