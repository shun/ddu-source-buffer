import { BaseSource, Item } from "https://deno.land/x/ddu_vim@v1.4.0/types.ts";
import { Denops, fn } from "https://deno.land/x/ddu_vim@v1.4.0/deps.ts";
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
  listed: boolean;
  name: string;
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
      const currentDir = await fn.getcwd(args.denops) as string;
      const curnr_ = await fn.bufnr(args.denops, "%");
      const altnr_ = await fn.bufnr(args.denops, "#");
      const lastnr_ = await fn.bufnr(args.denops, "$");

      const buffers: Item<ActionData>[] = [];

      const altinfo = await fn.getbufinfo(args.denops, "#") as BufInfo[];
      if (altinfo.length != 0) {
        buffers.push(get_actioninfo(altinfo[0], curnr_, altnr_, currentDir));
      }

      for (let i = 1; i <= lastnr_; ++i) {
        if (i === altnr_) {
          continue;
        }

        const bufinfos = await fn.getbufinfo(args.denops, i) as BufInfo[];
        if (bufinfos.length == 0 || !bufinfos[0].listed) {
          continue;
        }

        buffers.push(get_actioninfo(bufinfos[0], curnr_, altnr_, currentDir));
      }
      return buffers;
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
